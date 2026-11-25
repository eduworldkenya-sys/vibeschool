import 'server-only'
import { createClient } from '@supabase/supabase-js'
import {miniVoiceColumns} from './voice-release'
import {miniSlideColumns} from './slide-release'
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
    .select('id,title,body,creator_label,tags,cover_path,published_at'+miniSlideColumns()+miniVoiceColumns())
    .eq('id', id).eq('status','approved').maybeSingle()
  if(error || !data)return null
  const row:unknown=data
  if(!row || typeof row!=='object')return null
  const item=row as Record<string,unknown>
  if(typeof item.id!=='string'||typeof item.title!=='string'||typeof item.body!=='string'||typeof item.creator_label!=='string'||!Array.isArray(item.tags)||!item.tags.every((tag:unknown)=>typeof tag==='string')||(item.cover_path!==null&&typeof item.cover_path!=='string')||typeof item.published_at!=='string')return null
  return {id:item.id,title:item.title,body:item.body,creator_label:item.creator_label,tags:item.tags as string[],cover_path:item.cover_path,slide_deck:item.slide_deck,audio_path:typeof item.audio_path==='string'?item.audio_path:null,published_at:item.published_at}
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
