import { supabase } from '@/lib/supabase'
import type { RankedMini } from './recommendation'

export type MiniPost = RankedMini & {
  creator_label: string
  title: string
  body: string
  tags: string[]
  cover_path: string | null
  status: string
  created_at: string
}

export type ApprovedComment = {
  id: string
  body: string
  author_label: string
  created_at: string
}

export const MINI_SUBJECTS = [
  'History', 'Agriculture', 'Physics', 'Literature', 'Mathematics',
  'English', 'Kiswahili', 'Science', 'Creative Arts', 'General Knowledge',
] as const

export function isMiniPost(value: unknown): value is MiniPost {
  if (!value || typeof value !== 'object') return false
  const post = value as Partial<MiniPost>
  return typeof post.id === 'string' &&
    typeof post.creator_id === 'string' &&
    typeof post.creator_label === 'string' &&
    typeof post.title === 'string' &&
    typeof post.body === 'string' &&
    typeof post.subject === 'string' &&
    Array.isArray(post.tags) && post.tags.every(tag => typeof tag === 'string') &&
    typeof post.quality_score === 'number' &&
    typeof post.like_count === 'number' &&
    typeof post.save_count === 'number' &&
    typeof post.learned_count === 'number'
}

export async function fetchApprovedMinis(limit = 120): Promise<MiniPost[]> {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,cover_path,status,quality_score,like_count,save_count,learned_count,published_at,created_at')
    .eq('status','approved')
    .order('published_at', { ascending: false })
    .limit(Math.min(120, Math.max(1, limit)))
  if (error) throw new Error('Mini Lessons are temporarily unavailable.')
  return (Array.isArray(data) ? data : []).filter(isMiniPost)
}

export async function fetchOwnMiniStatus(userId: string) {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,title,tags,status,created_at')
    .eq('creator_id',userId).order('created_at',{ascending:false}).limit(30)
  if (error) throw new Error('Unable to load your submissions.')
  return (data ?? []) as { id: string; title: string; tags: string[]; status: string; created_at: string }[]
}

export async function loadMiniCovers(posts: MiniPost[]) {
  const urls: Record<string, string> = {}
  await Promise.all(posts.filter(p => p.cover_path).map(async post => {
    if (!post.cover_path) return
    const { data, error } = await supabase.storage.from('mini-covers')
      .createSignedUrl(post.cover_path, 3600)
    if (!error && data?.signedUrl) urls[post.id] = data.signedUrl
  }))
  return urls
}

export async function loadApprovedComments(id: string): Promise<ApprovedComment[]> {
  const { data, error } = await supabase.rpc('mini_approved_comments', { p_mini: id, p_limit: 30 })
  if (error) throw new Error('Comments are temporarily unavailable.')
  return (Array.isArray(data) ? data : []).filter((comment: unknown): comment is ApprovedComment => {
    if (!comment || typeof comment !== 'object') return false
    const item = comment as Partial<ApprovedComment>
    return typeof item.id === 'string' && typeof item.body === 'string'
      && typeof item.author_label === 'string' && typeof item.created_at === 'string'
  })
}
