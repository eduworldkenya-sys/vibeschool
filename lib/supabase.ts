import { createBrowserClient } from '@supabase/ssr'
import type { Database, Json } from './database.types'

/**
 * Production schema additions that have landed in Supabase before the generated
 * database.types.ts file is regenerated. Keep these additions typed here so
 * the application client remains strongly typed instead of falling back to any.
 */
type LiveDatabase = Database & {
  public: {
    Tables: Database['public']['Tables'] & {
      students: Database['public']['Tables']['students'] & {
        Row: Database['public']['Tables']['students']['Row'] & {
          self_use_enabled: boolean
          self_use_enabled_at: string | null
          self_use_enabled_by: string | null
        }
        Insert: Database['public']['Tables']['students']['Insert'] & {
          self_use_enabled?: boolean
          self_use_enabled_at?: string | null
          self_use_enabled_by?: string | null
        }
        Update: Database['public']['Tables']['students']['Update'] & {
          self_use_enabled?: boolean
          self_use_enabled_at?: string | null
          self_use_enabled_by?: string | null
        }
      }
    }
    Functions: Database['public']['Functions'] & {
      teacher_generate_shared_claim_code: {
        Args: { p_student_id: string }
        Returns: Json
      }
      parent_set_student_self_use: {
        Args: { p_student_id: string; p_enabled: boolean }
        Returns: Json
      }
      redeem_parent_claim: {
        Args: { p_code: string; p_user_id: string }
        Returns: string
      }
      redeem_student_claim: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
    }
  }
}

type TypedBrowserClient = ReturnType<typeof createBrowserClient<LiveDatabase>>

export function createSupabaseClient() {
  return createBrowserClient<LiveDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7,
      },
      cookieEncoding: 'raw',
    }
  )
}

// Safe singleton — only created once on client side
let client: TypedBrowserClient | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient()
  }
  return client
}

// Strongly typed client. New production schema additions are represented by
// LiveDatabase above rather than weakening the entire client to `any`.
export const supabase = getSupabaseClient()

export async function getTeacherProfile(userId: string) {
  const sb = getSupabaseClient()
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('full_name, phone, school_id, schools(name)')
    .eq('id', userId)
    .single()
  if (profileErr) { console.error('getTeacherProfile error:', profileErr); return null }

  return {
    name: profile?.full_name ?? '',
    school: (profile?.schools as unknown as { name: string } | null)?.name ?? '',
    phone: profile?.phone ?? '',
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
      phone: updates.phone,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
