import { supabase } from '@/lib/supabase'
import type { RankedMini } from './recommendation'
import { miniSearchText, MINI_ID } from './public-url'

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
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at')
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

export async function fetchMiniRequestAnswers(requestId: string): Promise<MiniPost[]> {
  const { data, error } = await supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at')
    .eq('status','approved').eq('request_id',requestId)
    .order('published_at',{ascending:false}).limit(60)
  if (error) throw Error('Unable to load explanations.')
  return (Array.isArray(data) ? data : []).filter(isMiniPost)
}

export type MiniCursor = {publishedAt:string;id:string}
export type MiniFeedFilter = {query?:string;tag?:string;creators?:string[]}
export async function fetchMiniPage(filter:MiniFeedFilter={},cursor?:MiniCursor) {
  const size = 24
  if (filter.creators && filter.creators.length===0) return {posts:[] as MiniPost[],next:undefined}
  let request = supabase.from('mini_lessons')
    .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at')
    .eq('status','approved')
  if (filter.tag && /^[a-z0-9_-]{2,32}$/.test(filter.tag)) request=request.contains('tags',[filter.tag])
  if (filter.creators) request=request.in('creator_id',filter.creators.filter(id=>MINI_ID.test(id)))
  const q=miniSearchText(filter.query??'')
  if(q) request=request.or('title.ilike.%'+q+'%,body.ilike.%'+q+'%,creator_label.ilike.%'+q+'%,subject.ilike.%'+q+'%'+(/^[a-z0-9_-]{2,32}$/i.test(q)?',tags.cs.{'+q.toLowerCase()+'}':''))
  if(cursor && MINI_ID.test(cursor.id) && Number.isFinite(Date.parse(cursor.publishedAt))) {
    const date=new Date(cursor.publishedAt).toISOString()
    // Preserve timestamp precision supplied by the database, after validating syntax.
    const stamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.publishedAt)?cursor.publishedAt:date
    request=request.or('published_at.lt.'+stamp+',and(published_at.eq.'+stamp+',id.lt.'+cursor.id+')')
  }
  const {data,error}=await request.order('published_at',{ascending:false}).order('id',{ascending:false}).limit(size+1)
  if(error) throw Error('Unable to load Mini Lessons. Please retry.')
  const rows=(Array.isArray(data)?data:[]).filter(isMiniPost)
  const posts=rows.slice(0,size)
  const last=posts[posts.length-1]
  const next:MiniCursor|undefined=rows.length>size && last?.published_at ? {publishedAt:last.published_at,id:last.id}:undefined
  return {posts,next}
}
