import { supabase } from '@/lib/supabase'
import { parseMiniHashtags } from './tags'
import { currentMiniUser } from './actions'

export type MiniPublicRequest = {
  id: string
  question: string
  tags: string[]
  supporters: number
  explanations: number
  created_at: string
}
export type MiniOwnRequest = {
  id: string
  question: string
  tags: string[]
  status: string
  explanations: number
  created_at: string
}

export async function fetchMiniRequests(): Promise<MiniPublicRequest[]> {
  const { data, error } = await supabase.rpc('mini_public_requests', { p_limit: 60 })
  if (error) throw Error('Unable to load requests.')
  return (Array.isArray(data) ? data : []).filter((v: unknown): v is MiniPublicRequest => {
    const row = v as Partial<MiniPublicRequest> | null
    return !!row && typeof row.id === 'string' && typeof row.question === 'string'
      && Array.isArray(row.tags) && typeof row.supporters === 'number'
      && typeof row.explanations === 'number'
  })
}

export async function fetchMyMiniRequests(): Promise<MiniOwnRequest[]> {
  const { data, error } = await supabase.rpc('mini_my_requests', { p_limit: 40 })
  if (error) throw Error('Unable to load your requests.')
  return (data ?? []) as MiniOwnRequest[]
}

export async function fetchMiniRequestSupports(userId: string): Promise<Set<string>> {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) return new Set()
  const { data, error } = await supabase.from('mini_request_supports').select('request_id')
    .eq('user_id',verified).limit(1000)
  if (error) throw Error('Unable to load your request interests.')
  return new Set((data ?? []).map((row: { request_id: string }) => row.request_id))
}

export async function submitMiniRequest(question: string, hashtags: string): Promise<string> {
  const verified = await currentMiniUser()
  if (!verified) throw Error('Sign in to request a Mini Lesson.')
  const clean = question.trim()
  if (clean.length < 12 || clean.length > 240) throw Error('Ask a clear question of 12–240 characters.')
  if (/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?254|0)[17]\d{8}/i.test(clean))
    throw Error('Remove links and personal contact details from the question.')
  const tags = parseMiniHashtags(hashtags)
  const { data, error } = await supabase.from('mini_requests')
    .insert({ requester_id: verified, question: clean, tags }).select('id').single()
  if (error || !data?.id) throw Error('Request not submitted. Check your account and daily limit.')
  return data.id as string
}

export async function changeRequestSupport(requestId: string, on: boolean) {
  const verified = await currentMiniUser()
  if (!verified) throw Error('Sign in to support a request.')
  const result = on
    ? await supabase.from('mini_request_supports').insert({ request_id: requestId,user_id: verified })
    : await supabase.from('mini_request_supports').delete().eq('request_id',requestId).eq('user_id',verified)
  if (result.error && !(on && result.error.code==='23505')) throw Error('Unable to update request support.')
}
