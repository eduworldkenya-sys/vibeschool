import type { VibePublication } from '@/lib/publishTypes'

export type StoryPublication = Pick<VibePublication,
  'id' | 'title' | 'subtitle' | 'description' | 'cover_url' | 'format' |
  'genre' | 'series_name' | 'series_number' | 'published_at' | 'pricing' | 'chapter_count'>

const FICTION_GENRES = new Set(['fiction','children','romance','thriller','fantasy','mystery','adventure'])

/** Story identity belongs to the publication, never to a hard-coded route or book ID. */
export function isStoryPublication(p: {format:string;genre:string|null;series_name:string|null}) {
  return p.format === 'vibechronicles'
    || (p.format === 'ebook' && (Boolean(p.series_name?.trim()) || FICTION_GENRES.has(String(p.genre).toLowerCase())))
}

export function storyLandingHref(id: string) {
  return '/learn/stories/' + encodeURIComponent(id)
}

export function storyReaderHref(id: string, chapterId?: string | null, resume = false) {
  const url = storyLandingHref(id) + '/read'
  const qs = new URLSearchParams()
  if (chapterId) qs.set('chapter', chapterId)
  if (resume) qs.set('resume', '1')
  return qs.size ? url + '?' + qs : url
}

export function safeStoryImage(url: string | null | undefined) {
  if (!url) return null
  const source = url.trim()
  if (source.startsWith('/') && !source.startsWith('//')) return source
  try { const parsed = new URL(source); return ['https:','http:'].includes(parsed.protocol) ? source : null }
  catch { return null }
}

/** Render editor paragraph blocks as plain, safely escaped prose instead of editor chrome. */
export function storyText(html: string) {
  return html.replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39|#34);/g, entity => ({
      '&nbsp;':' ', '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'", '&#39;':"'", '&#34;':'"'
    } as Record<string,string>)[entity] || entity)
    .trim()
}

/** Guest progress uses the same per-book key as the existing Originals reader. */
export const STORY_GUEST_KEY = 'vibeschool.originals.guest.'

/** Series order is a reading order, not publication recency. No manual curation required. */
export function orderSeriesBooks<T extends {series_number:number|null;published_at:string|null;title:string|null}>(books:T[]):T[] {
  return [...books].sort((a,b)=>{
    const left=typeof a.series_number==='number'&&a.series_number>0?a.series_number:Number.MAX_SAFE_INTEGER
    const right=typeof b.series_number==='number'&&b.series_number>0?b.series_number:Number.MAX_SAFE_INTEGER
    return left-right || String(a.published_at||'').localeCompare(String(b.published_at||'')) || String(a.title||'').localeCompare(String(b.title||''))
  })
}
