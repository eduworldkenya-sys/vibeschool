import 'server-only'

import { cache } from 'react'
import { getSupabaseServerClient } from '@/lib/supabaseServer'
import type { ContentBlock, VibePublication } from '@/lib/publishTypes'

export type PublishedBlogArticle = Pick<VibePublication,
  'id' | 'title' | 'subtitle' | 'description' | 'cover_url' | 'genre' | 'tags' |
  'language' | 'published_at' | 'updated_at'
>

export type PublishedBlogChapter = {
  id: string
  title: string | null
  number: number
  blocks: ContentBlock[]
  reading_time_min: number
}

export type PublishedBlogStory = {
  publication: PublishedBlogArticle
  chapters: PublishedBlogChapter[]
  authorName: string
}

const ARTICLE_FIELDS = 'id,title,subtitle,description,cover_url,genre,tags,language,published_at,updated_at'
const EDITORIAL_DESKS: Record<string, string> = {
  'desk:editorial': 'VibeSchool Editorial',
  'desk:education': 'VibeSchool Education Desk',
  'desk:parent': 'VibeSchool Parent Desk',
  'desk:student': 'VibeSchool Student Desk',
}
const BLOCK_TYPES: string[] = [
  'paragraph','heading1','heading2','heading3','quote','bulletList','numberedList','image','diagram','table','equation',
  'video','audio','model3d','simulation','divider','callout','definition','example','workedExample','summary','keyPoints','code',
  'activity','experiment','project','question','interactive',
]

export function isPublicBlogReady(article: Pick<PublishedBlogArticle,'title'|'description'> & {tags:string[]|null}){
  return Boolean(article.title?.trim()&&article.title.trim().length>=12&&article.description?.trim()&&article.description.trim().length>=60&&(article.tags??[]).some(tag=>tag.trim()))
}

export function resolveEditorialByline(article: Pick<PublishedBlogArticle,'tags'>, profileName?: string | null) {
  for (const tag of article.tags ?? []) {
    const desk = EDITORIAL_DESKS[tag.trim().toLowerCase()]
    if (desk) return desk
  }
  return profileName?.trim() || 'VibeSchool Editorial'
}

export const listPublishedBlogArticles = cache(async (): Promise<PublishedBlogArticle[]> => {
  try {
    const { data, error } = await getSupabaseServerClient()
      .from('vibe_publications')
      .select(ARTICLE_FIELDS)
      .eq('status', 'published')
      .eq('format', 'vibepress')
      .order('published_at', { ascending: false })
      .limit(60)
    if (error) throw error
    return ((data ?? []) as PublishedBlogArticle[]).filter(isPublicBlogReady)
  } catch {
    return []
  }
})

export const getPublishedBlogStory = cache(async (id: string): Promise<PublishedBlogStory | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  try {
    const supabase = getSupabaseServerClient()
    const { data: publication, error } = await supabase
      .from('vibe_publications')
      .select(`${ARTICLE_FIELDS},author_id`)
      .eq('id', id)
      .eq('status', 'published')
      .eq('format', 'vibepress')
      .maybeSingle()
    if (error || !publication || !isPublicBlogReady(publication as PublishedBlogArticle)) return null
    const [chaptersResult, profileResult] = await Promise.all([
      supabase.from('vibe_chapters').select('id,title,number,blocks,reading_time_min').eq('publication_id', id).eq('status', 'published').order('number'),
      supabase.from('profiles').select('full_name').eq('id', publication.author_id).maybeSingle(),
    ])
    const chapters: PublishedBlogChapter[] = (chaptersResult.data ?? []).map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      number: chapter.number,
      blocks: Array.isArray(chapter.blocks) ? chapter.blocks.map(toContentBlock).filter((block): block is ContentBlock => block !== null) : [],
      reading_time_min: chapter.reading_time_min,
    }))
    return {
      publication: publication as PublishedBlogArticle,
      chapters,
      authorName: resolveEditorialByline(publication as PublishedBlogArticle, profileResult.data?.full_name),
    }
  } catch {
    return null
  }
})

function toContentBlock(value: unknown): ContentBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.content !== 'string' || !isBlockType(record.type)) return null
  const block: ContentBlock = { id: record.id, type: record.type, content: record.content }
  const meta = toBlockMeta(record.meta)
  if (meta) block.meta = meta
  return block
}

function isBlockType(value: unknown): value is ContentBlock['type'] {
  return typeof value === 'string' && BLOCK_TYPES.includes(value)
}

function toBlockMeta(value: unknown): ContentBlock['meta'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const meta: NonNullable<ContentBlock['meta']> = {}
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') meta[key] = item
    else if (Array.isArray(item) && item.every(entry => typeof entry === 'string')) meta[key] = item
  }
  return Object.keys(meta).length ? meta : undefined
}