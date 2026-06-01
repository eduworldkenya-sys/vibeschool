'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { VibeStory, AgeRange, StoryLanguage, StoryStatus, StoryCharacter } from '@/lib/storyTypes'

interface DatabaseStory {
  id: string
  title: string | null
  status: string | null
  age_range: string | null
  language: string | null
  cover_image_url: string | null
  author_id: string | null
  description: string | null
  page_count: number | null
  view_count: number | null
  vibe_count: number | null
  earnings_ksh: number | null
  tags: string[] | null
  characters: Record<string, unknown>[] | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export function useStoryFeed() {
  const [stories, setStories] = useState<VibeStory[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [ageFilter, setAgeFilter] = useState<AgeRange | 'all'>('all')
  const [langFilter, setLangFilter] = useState<StoryLanguage | 'all'>('all')
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(true)

  const PAGE_SIZE = 12

  const mapDatabaseRecord = (record: DatabaseStory): VibeStory => {
    return {
      id: record.id,
      title: record.title || 'Untitled Masterpiece',
      status: (record.status as StoryStatus) || 'draft',
      ageRange: (record.age_range as AgeRange) || '4-8',
      language: (record.language as StoryLanguage) || 'en',
      coverImageUrl: record.cover_image_url || null,
      authorId: record.author_id || '',
      description: record.description || null,
      pageCount: record.page_count || 0,
      viewCount: record.view_count || 0,
      vibeCount: record.vibe_count || 0,
      earningsKsh: record.earnings_ksh || 0,
      tags: record.tags || [],
      characters: (record.characters || []) as StoryCharacter[],
      createdAt: record.created_at || '',
      updatedAt: record.updated_at || '',
      publishedAt: record.published_at || null,
    }
  }

  const fetchStoriesPage = useCallback(async (
    currentPage: number,
    currentAge: AgeRange | 'all',
    currentLang: StoryLanguage | 'all',
    shouldAppend: boolean
  ) => {
    setLoading(true)
    setError(null)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      const fromRange = (currentPage - 1) * PAGE_SIZE
      const toRange = fromRange + PAGE_SIZE - 1

      let query = supabase
        .from('vibe_stories')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(fromRange, toRange)

      if (currentAge !== 'all') {
        query = query.eq('age_range', currentAge)
      }

      if (currentLang !== 'all') {
        query = query.eq('language', currentLang)
      }

      const { data, error: fetchErr } = await query

      if (fetchErr) throw fetchErr

      const dbRecords = (data || []) as DatabaseStory[]
      const cleanStories = dbRecords.map(mapDatabaseRecord)

      setStories((prev) => shouldAppend ? [...prev, ...cleanStories] : cleanStories)
      setHasMore(dbRecords.length === PAGE_SIZE)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load stories.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchStoriesPage(1, ageFilter, langFilter, false)
  }, [ageFilter, langFilter, fetchStoriesPage])

  const loadMore = () => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchStoriesPage(nextPage, ageFilter, langFilter, true)
  }

  return {
    stories,
    loading,
    error,
    hasMore,
    ageFilter,
    setAgeFilter,
    langFilter,
    setLangFilter,
    loadMore,
  }
}
