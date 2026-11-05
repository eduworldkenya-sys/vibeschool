import { createClient } from '@supabase/supabase-js'
import { cache } from 'react'
import type { PublicSchoolAddress } from './school-urls'

type UrlDatabase = { public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: {
  schools_resolve_url_public_v1: { Args: { p_slug?: string; p_school_id?: string; p_directory_id?: string }; Returns: PublicSchoolAddress[] }
} } }
// Public credentials deliberately enforce the same projection used by anonymous visitors.
export const resolveSchoolAddress = cache(async (kind: 'slug' | 'school' | 'directory', value: string) => {
  if (kind === 'slug' ? !/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(value) : !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return null
  const client = createClient<UrlDatabase>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const args = kind === 'slug' ? { p_slug: value } : kind === 'school' ? { p_school_id: value } : { p_directory_id: value }
  const { data, error } = await client.rpc('schools_resolve_url_public_v1', args)
  // An outage must remain retryable, rather than becoming a cached missing-school response.
  if (error) throw new Error('School address lookup temporarily unavailable')
  return data?.length === 1 ? data[0] : null
})
