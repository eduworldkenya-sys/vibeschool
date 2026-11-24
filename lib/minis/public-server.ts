import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { MINI_ID } from './public-url'

export const minisPublicEnabled = () => process.env.NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // Deliberately anonymous, never service-role: RLS is the visibility authority.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } })
}
export async function readPublicMini(id: string) {
  if (!minisPublicEnabled() || !MINI_ID.test(id)) return null
  const client = publicClient()
  if (!client) return null
  const { data, error } = await client.from('mini_lessons')
    .select('id,title,body,creator_label,tags,cover_path,audio_path,published_at')
    .eq('id', id).eq('status','approved').maybeSingle()
  return error || !data ? null : data as { id:string;title:string;body:string;creator_label:string;tags:string[];cover_path:string|null;audio_path:string|null;published_at:string }
}
export async function publicMiniCover(id: string) {
  const mini = await readPublicMini(id)
  if (!mini?.cover_path) return null
  const client = publicClient()
  if (!client) return null
  const { data, error } = await client.storage.from('mini-covers').createSignedUrl(mini.cover_path, 60)
  return error ? null : data?.signedUrl ?? null
}
export async function publicMiniSitemap() {
  if (!minisPublicEnabled()) return []
  const client = publicClient()
  if (!client) return []
  const { data,error } = await client.from('mini_lessons').select('id,published_at')
    .eq('status','approved').order('published_at',{ascending:false}).limit(1000)
  return error ? [] : (data ?? []) as {id:string;published_at:string}[]
}
