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

export function isPublicBlogReady(article: Pick<PublishedBlogArticle,'title'|'description'> & {tags:string[]|null}){
  return Boolean(article.title?.trim()&&article.title.trim().length>=12&&article.description?.trim()&&article.description.trim().length>=60&&(article.tags??[]).some(tag=>tag.trim()))
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
      blocks: Array.isArray(chapter.blocks) ? chapter.blocks.filter(isContentBlock) : [],
      reading_time_min: chapter.reading_time_min,
    }))
    return {
      publication: publication as PublishedBlogArticle,
      chapters,
      authorName: profileResult.data?.full_name?.trim() || 'VibeSchool Editorial',
    }
  } catch {
    return null
  }
})

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.type === 'string' && typeof record.content === 'string'
}
