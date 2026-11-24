import { supabase } from '@/lib/supabase'
import {miniSlideColumns} from './slide-release'
import type { RankedMini } from './recommendation'

export type MiniPost = RankedMini & {
  creator_label: string
  title: string
  body: string
  tags: string[]
  quiz_question: string | null
  quiz_options: string[]
  quiz_correct: number | null
  quiz_explanation: string | null
  cover_path: string | null
  slide_deck?: unknown
  status: string
  request_id: string | null
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
    Array.isArray(post.quiz_options) && post.quiz_options.every(choice => typeof choice === 'string') &&
    typeof post.quality_score === 'number' &&
    typeof post.like_count === 'number' &&
    typeof post.save_count === 'number' &&
    typeof post.learned_count === 'number'
}

export async function fetchApprovedMinis(limit = 120): Promise<MiniPost[]> {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at'+miniSlideColumns())
    .eq('status','approved')
    .order('published_at', { ascending: false })
    .limit(Math.min(120, Math.max(1, limit)))
  if (error) throw new Error('Mini Lessons are temporarily unavailable.')
  return (Array.isArray(data) ? data : []).filter(isMiniPost)
}

export const MINI_PAGE_SIZE = 24
export type MiniCursor = { publishedAt: string; id: string }

/** Search all publicly readable approved rows, not just the initial feed. */
export async function fetchMiniPage({ search = '', tag = 'All', cursor, creators }: {
  search?: string; tag?: string; cursor?: MiniCursor; creators?: readonly string[]
} = {}): Promise<{ posts: MiniPost[]; nextCursor: MiniCursor | null }> {
  if (creators && !creators.length) return { posts: [], nextCursor: null }
  // Only allow ordinary search characters in the PostgREST OR expression.
  const term = search.normalize('NFKC').replace(new RegExp('[^\\p{L}\\p{N}\\s_-]', 'gu'), ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  const exactTag = search.trim().replace(/^#/, '').toLowerCase()
  let query = supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at'+miniSlideColumns())
    .eq('status','approved')
  if (tag !== 'All') query = query.contains('tags', [tag])
  if (creators) query = query.in('creator_id', [...creators])
  if (term) {
    const pattern = '%' + term.replace(/_/g, '\\_') + '%'
    const filters = ['title','body','creator_label','subject'].map(column => column + '.ilike.' + pattern)
    if (/^[a-z][a-z0-9_]{1,29}$/.test(exactTag)) filters.push('tags.cs.{' + exactTag + '}')
    query = query.or(filters.join(','))
  } else if (search.trim()) return { posts: [], nextCursor: null }
  if(cursor){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.publishedAt) || !Number.isFinite(Date.parse(cursor.publishedAt))) throw Error('Invalid feed cursor.')
    query=query.or('published_at.lt.'+cursor.publishedAt+',and(published_at.eq.'+cursor.publishedAt+',id.lt.'+cursor.id+')')
  }
  const { data, error } = await query.order('published_at',{ascending:false})
    .order('id',{ascending:false}).limit(MINI_PAGE_SIZE+1)
  if (error) throw Error('Unable to load Mini Lessons. Try again.')
  const rows = Array.isArray(data) ? data : []
  const posts = rows.slice(0, MINI_PAGE_SIZE).filter(isMiniPost)
  const last = posts[posts.length-1]
  return { posts, nextCursor: rows.length > MINI_PAGE_SIZE && last?.published_at ? {publishedAt:last.published_at,id:last.id} : null }
}

export async function fetchOwnMiniStatus(userId: string) {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,title,tags,status,created_at,like_count,save_count,learned_count')
    .eq('creator_id',userId).order('created_at',{ascending:false}).limit(30)
  if (error) throw new Error('Unable to load your submissions.')
  return (data ?? []) as { id: string; title: string; tags: string[]; status: string; created_at: string; like_count:number; save_count:number; learned_count:number }[]
}

export async function loadMiniCovers(posts: MiniPost[]) {
  const urls: Record<string, string> = {}
  const withCovers = posts.filter(p => p.cover_path)
  for (let start = 0; start < withCovers.length; start += 24) {
    const batch = withCovers.slice(start,start+24)
    const { data, error } = await supabase.storage.from('mini-covers')
      .createSignedUrls(batch.map(post => post.cover_path!), 3600)
    if (!error && data) {
      const byPath = new Map(data.filter(item=>item.path && item.signedUrl).map(item=>[item.path,item.signedUrl]))
      for (const post of batch) {
        const url = byPath.get(post.cover_path!)
        if (url) urls[post.id] = url
      }
    }
  }
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

export async function fetchMiniRequestAnswers(requestId: string): Promise<MiniPost[]> {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at'+miniSlideColumns())
    .eq('status','approved').eq('request_id',requestId)
    .order('published_at',{ascending:false}).limit(60)
  if (error) throw Error('Unable to load explanations.')
  return (Array.isArray(data) ? data : []).filter(isMiniPost)
}
