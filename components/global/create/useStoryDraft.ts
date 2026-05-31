'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  VibeStory,
  StoryPage,
  emptyStory,
  emptyPage,
} from '@/lib/storyTypes'

const AUTOSAVE_MS = 3000

function storyToDb(s: VibeStory) {
  return {
    id:              s.id,
    author_id:       s.authorId,
    title:           s.title || 'Untitled Story',
    cover_image_url: s.coverImageUrl,
    description:     s.description,
    language:        s.language,
    age_range:       s.ageRange,
    tags:            s.tags,
    characters:      s.characters,
    status:          s.status,
    page_count:      s.pageCount,
    published_at:    s.publishedAt,
  }
}

function pageToDb(page: StoryPage) {
  return {
    id:                  page.id,
    story_id:            page.storyId,
    page_number:         page.pageNumber,
    illustration_url:    page.illustrationUrl,
    illustration_prompt: page.illustrationPrompt,
    text_blocks:         page.textBlocks,
    speech_bubbles:      page.speechBubbles,
    background_color:    page.backgroundColor,
  }
}

export function useStoryDraft(authorId: string) {
  const [story,       setStory]       = useState<VibeStory>(emptyStory(authorId))
  const [pages,       setPages]       = useState<StoryPage[]>([emptyPage('', 1)])
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving,      setSaving]      = useState(false)
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const storyRef          = useRef(story)
  const pagesRef          = useRef(pages)
  const deletedPageIdsRef = useRef<string[]>([])

  storyRef.current = story
  pagesRef.current = pages

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function loadDraft() {
      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('vibe_stories')
          .select('*')
          .eq('author_id', authorId)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (fetchErr) throw fetchErr

        if (existing) {
          setStory({
            id:            existing.id,
            authorId:      existing.author_id,
            title:         existing.title,
            coverImageUrl: existing.cover_image_url,
            description:   existing.description,
            language:      existing.language,
            ageRange:      existing.age_range,
            tags:          existing.tags ?? [],
            characters:    existing.characters ?? [],
            status:        existing.status,
            pageCount:     existing.page_count,
            viewCount:     existing.view_count,
            vibeCount:     existing.vibe_count,
            earningsKsh:   existing.earnings_ksh,
            createdAt:     existing.created_at,
            updatedAt:     existing.updated_at,
            publishedAt:   existing.published_at,
          })

          const { data: rawPages, error: pagesErr } = await supabase
            .from('vibe_story_pages')
            .select('*')
            .eq('story_id', existing.id)
            .order('page_number', { ascending: true })

          if (pagesErr) throw pagesErr

          if (rawPages && rawPages.length > 0) {
            setPages(rawPages.map(p => ({
              id:                 p.id,
              storyId:            p.story_id,
              pageNumber:         p.page_number,
              illustrationUrl:    p.illustration_url,
              illustrationPrompt: p.illustration_prompt,
              textBlocks:         p.text_blocks ?? [],
              speechBubbles:      p.speech_bubbles ?? [],
              backgroundColor:    p.background_color,
            })))
          } else {
            setPages([emptyPage(existing.id, 1)])
          }
        } else {
          const fresh = emptyStory(authorId)
          setStory(fresh)
          setPages([emptyPage(fresh.id, 1)])
        }
      } catch (e: unknown) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    loadDraft()
  }, [authorId])

  const persistDraft = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const s          = storyRef.current
    const p          = pagesRef.current
    const deletedIds = [...deletedPageIdsRef.current]
    setSaving(true)
    try {
      const { error: upsertErr } = await supabase
        .from('vibe_stories')
        .upsert(storyToDb(s), { onConflict: 'id' })
      if (upsertErr) throw upsertErr

      if (deletedIds.length > 0) {
        const { error: deleteErr } = await supabase
          .from('vibe_story_pages')
          .delete()
          .in('id', deletedIds)
        if (deleteErr) throw deleteErr
        deletedPageIdsRef.current = []
      }

      if (p.length > 0) {
        const { error: batchErr } = await supabase
          .from('vibe_story_pages')
          .upsert(p.map(pageToDb), { onConflict: 'id' })
        if (batchErr) throw batchErr
      }

      setLastSaved(new Date())
      setError(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(persistDraft, AUTOSAVE_MS)
  }, [persistDraft])

  const updateStory = useCallback((patch: Partial<VibeStory>) => {
    setStory(prev => ({ ...prev, ...patch }))
    scheduleSave()
  }, [scheduleSave])

  const updatePage = useCallback((id: string, patch: Partial<StoryPage>) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    scheduleSave()
  }, [scheduleSave])

  const addPage = useCallback(() => {
    setPages(prev => {
      const newPage = emptyPage(storyRef.current.id, prev.length + 1)
      const next    = [...prev, newPage]
      setActiveIndex(next.length - 1)
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const deletePage = useCallback((id: string) => {
    const current = pagesRef.current
    if (current.length <= 1) return
    const index = current.findIndex(p => p.id === id)
    if (index === -1) return
    deletedPageIdsRef.current.push(id)
    setPages(prev =>
      prev
        .filter(p => p.id !== id)
        .map((p, i) => ({ ...p, pageNumber: i + 1 }))
    )
    setActiveIndex(prev => Math.max(0, Math.min(prev, current.length - 2)))
    scheduleSave()
  }, [scheduleSave])

  const movePage = useCallback((from: number, to: number) => {
    if (from === to) return
    setPages(prev => {
      const next    = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((p, i) => ({ ...p, pageNumber: i + 1 }))
    })
    setActiveIndex(to)
    scheduleSave()
  }, [scheduleSave])

  const publishStory = useCallback(async (): Promise<boolean> => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    if (timerRef.current) clearTimeout(timerRef.current)
    await persistDraft()
    const { error: pubErr } = await supabase
      .from('vibe_stories')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', storyRef.current.id)
    if (pubErr) { setError(pubErr.message); return false }
    setStory(prev => ({ ...prev, status: 'published', publishedAt: new Date().toISOString() }))
    return true
  }, [persistDraft])

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    persistDraft()
  }, [persistDraft])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return {
    story,
    pages,
    activePage: pages[activeIndex] ?? pages[0],
    activeIndex,
    saving,
    lastSaved,
    loading,
    error,
    updateStory,
    updatePage,
    deletePage,
    addPage,
    movePage,
    setActiveIndex,
    publishStory,
    saveNow,
  }
}
