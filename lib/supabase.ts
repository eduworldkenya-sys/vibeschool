import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { getHQSupabaseClient } from './hq/supabase'

type GeneratedHomeworkTable = Database['public']['Tables']['homework']

type LiveHomeworkProvenance = {
  source_publication_id: string | null
  source_chapter_id: string | null
  source_resource_id: string | null
  source_block_id: string | null
  source_outcome_id: string | null
  teaching_occurrence_id: string | null
}

type LiveHomeworkTable = {
  Row: GeneratedHomeworkTable['Row'] & LiveHomeworkProvenance
  Insert: GeneratedHomeworkTable['Insert'] & Partial<LiveHomeworkProvenance>
  Update: GeneratedHomeworkTable['Update'] & Partial<LiveHomeworkProvenance>
  Relationships: GeneratedHomeworkTable['Relationships']
}

/**
 * Production can briefly lead the checked-in generated Supabase snapshot.
 * Keep verified drift precise here instead of weakening feature code with
 * `any`/`unknown` casts. Regenerating database.types.ts can later collapse this
 * overlay without changing callers.
 */
type LiveDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'homework'> & {
      homework: LiveHomeworkTable
    }
  }
}

export function createSupabaseClient() {
  return createBrowserClient<LiveDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7,
      },
      cookieEncoding: "raw",
    }
  )
}

type TypedBrowserClient = ReturnType<typeof createBrowserClient<LiveDatabase>>
type LiveSchemaCompatClient = TypedBrowserClient & {
  from(relation: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

let client: TypedBrowserClient | null = null

export function getSupabaseClient() {
  if (!client) client = createSupabaseClient()
  return client
}

function activeBrowserClient(): any {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/hq')) {
    return getHQSupabaseClient()
  }
  return getSupabaseClient()
}

// Compatibility proxy: legacy HQ browser surfaces historically imported the shared
// client. Resolve the client at call time so /hq always uses the isolated HQ session,
// while every non-HQ route continues to use the normal application session. This also
// remains correct across client-side navigation because the pathname is checked for
// every property access rather than when the module singleton is first created.
export const supabase = new Proxy({} as LiveSchemaCompatClient, {
  get(_target, prop) {
    const active = activeBrowserClient()
    const value = active[prop as keyof typeof active]
    return typeof value === 'function' ? value.bind(active) : value
  },
})

export async function getTeacherProfile(userId: string) {
  const sb = getSupabaseClient()
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('full_name, phone, school_id, schools(name)')
    .eq('id', userId)
    .single()
  if (profileErr) { console.error('getTeacherProfile error:', profileErr); return null }

  const joinedSchool = Array.isArray(profile?.schools)
    ? profile.schools[0] ?? null
    : profile?.schools ?? null

  return {
    name:   profile?.full_name ?? '',
    school: joinedSchool?.name ?? '',
    phone:  profile?.phone ?? '',
  }
}

export async function updateTeacherProfile(userId: string, updates: {
  name?: string
  phone?: string
}) {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('profiles')
    .update({
      full_name: updates.name,
      phone:     updates.phone,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!