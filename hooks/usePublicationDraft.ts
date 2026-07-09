'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  VibePublication,
  VibeChapter,
  ContentBlock,
  BlockType,
  ChapterStatus,
  PricingModel,
  PublicationFormat,
  emptyPublication,
  emptyChapter,
  calcWordCount,
  calcReadingTime,
} from '@/lib/publishTypes'

const AUTOSAVE_MS = 3000

// Determines the status a chapter should adopt on publish, based on the
// publication's pricing model. Chapters the author has already set manually
// (anything not still 'draft') are left untouched by the bulk transition.
function chapterStatusForPricing(pricing: PricingModel, chapterNumber: number): ChapterStatus {
  switch (pricing.type) {
    case 'free':
    case 'donation':
      return 'published'
    case 'paid':
    case 'school_license':
      return 'locked'
    case 'freemium':
      return chapterNumber <= pricing.freeChapters ? 'published' : 'locked'
    default:
      return 'published'
  }
}

export interface UsePublicationDraftResult {
  loading:              boolean
  saving:               boolean
  lastSaved:            Date | null
  error:                string | null
  publication:          VibePublication | null
  chapters:             VibeChapter[]
  activeChapterId:      string | null
  setActiveChapterId:   (id: string) => void
  updatePublication:    (updates: Partial<VibePublication>) => void
  updateChapterTitle:   (id: string, title: string) => void
  updateChapterStatus:  (id: string, status: ChapterStatus) => void
  addChapter:           () => void
  deleteChapter:        (id: string) => void
  addBlock:             (type: BlockType, afterBlockId?: string) => void
  updateBlock:          (blockId: string, content: string, meta?: ContentBlock['meta']) => void
  deleteBlock:          (blockId: string) => void
  moveBlock:            (blockId: string, direction: 'up' | 'down') => void
  publishPublication:   () => Promise<boolean>
  forceSave:            () => Promise<void>
}

export function usePublicationDraft(
  authorId:        string,
  format:          PublicationFormat,
  publicationId?:  string
): UsePublicationDraftResult {

  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [lastSaved,        setLastSaved]        = useState<Date | null>(null)
  const [error,            setError]            = useState<string | null>(null)
  const [publication,      setPublication]      = useState<VibePublication | null>(null)
  const [chapters,         setChapters]         = useState<VibeChapter[]>([])
  const [activeChapterId,  setActiveChapterId]  = useState<string | null>(null)

  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pubRef         = useRef<VibePublication | null>(null)
  const chapRef        = useRef<VibeChapter[]>([])
  const deletedIdsRef  = useRef<string[]>([])

  pubRef.current  = publication
  chapRef.current = chapters

  // ── Load or create ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      try {
        let pub: VibePublication | null = null

        if (publicationId) {
          const { data, error: e } = await sb
            .from('vibe_publications')
            .select('*')
            .eq('id', publicationId)
            .single()
          if (e) throw e
          pub = data as VibePublication
        } else {
          const { data: existing } = await sb
            .from('vibe_publications')
            .select('*')
            .eq('author_id', authorId)
            .eq('format', format)
            .eq('status', 'draft')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existing) {
            pub = existing as VibePublication
          } else {
            const fresh = emptyPublication(authorId, format)
            const { data: inserted, error: ie } = await sb
              .from('vibe_publications')
              .insert({
                id:               fresh.id,
                author_id:        fresh.author_id,
                format:           fresh.format,
                title:            fresh.title,
                subtitle:         fresh.subtitle,
                cover_url:        fresh.cover_url,
                description:      fresh.description,
                genre:            fresh.genre,
                tags:             fresh.tags,
                language:         fresh.language,
                status:           fresh.status,
                pricing:          fresh.pricing,
                chapter_count:    fresh.chapter_count,
                cbc_subject:      fresh.cbc_subject,
                cbc_grade:        fresh.cbc_grade,
                cbc_aligned:      fresh.cbc_aligned,
                series_name:      fresh.series_name,
                series_number:    fresh.series_number,
                publication_name: fresh.publication_name,
                issue_number:     fresh.issue_number,
              })
              .select('*')
              .single()
            if (ie) throw ie
            pub = inserted as VibePublication
          }
        }

        const { data: rawChaps, error: ce } = await sb
          .from('vibe_chapters')
          .select('*')
          .eq('publication_id', pub.id)
          .order('number', { ascending: true })
        if (ce) throw ce

        let chaps: VibeChapter[] = (rawChaps || []) as VibeChapter[]

        if (chaps.length === 0) {
          const first = emptyChapter(pub.id, 1)
          const { data: ic, error: ice } = await sb
            .from('vibe_chapters')
            .insert({
              id:               first.id,
              publication_id:   first.publication_id,
              title:            first.title,
              number:           first.number,
              blocks:           first.blocks,
              status:           first.status,
              word_count:       first.word_count,
              reading_time_min: first.reading_time_min,
              learning_outcomes: first.learning_outcomes,
              cbc_strand:       first.cbc_strand,
            })
            .select('*')
            .single()
          if (ice) throw ice
          chaps = [ic as VibeChapter]
        }

        if (!cancelled) {
          setPublication(pub)
          setChapters(chaps)
          setActiveChapterId(chaps[0].id)
          pubRef.current  = pub
          chapRef.current = chaps
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authorId, format, publicationId])

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(async () => {
    const pub   = pubRef.current
    const chaps = chapRef.current
    const delIds = [...deletedIdsRef.current]
    if (!pub) return
    setSaving(true)
    try {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: pe } = await sb
        .from('vibe_publications')
        .upsert(
          { ...pub, updated_at: new Date().toISOString(), chapter_count: chaps.length },
          { onConflict: 'id' }
        )
      if (pe) throw pe

      if (delIds.length > 0) {
        await sb.from('vibe_chapters').delete().in('id', delIds)
        deletedIdsRef.current = []
      }

      if (chaps.length > 0) {
        const { error: ce } = await sb
          .from('vibe_chapters')
          .upsert(
            chaps.map(c => ({ ...c, updated_at: new Date().toISOString() })),
            { onConflict: 'id' }
          )
        if (ce) throw ce
      }
      setLastSaved(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(persist, AUTOSAVE_MS)
  }, [persist])

  const forceSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await persist()
  }, [persist])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── Publication actions ───────────────────────────────────────────────────
  const updatePublication = useCallback((updates: Partial<VibePublication>) => {
    setPublication(prev => {
      if (!prev) return null
      const next = { ...prev, ...updates }
      pubRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  // ── Chapter actions ───────────────────────────────────────────────────────
  const updateChapterTitle = useCallback((id: string, title: string) => {
    setChapters(prev => {
      const next = prev.map(c => c.id === id ? { ...c, title } : c)
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const updateChapterStatus = useCallback((id: string, status: ChapterStatus) => {
    setChapters(prev => {
      const next = prev.map(c => c.id !== id ? c : {
        ...c,
        status,
        published_at: status === 'published' ? (c.published_at ?? new Date().toISOString()) : c.published_at,
      })
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const addChapter = useCallback(() => {
    const pub   = pubRef.current
    const chaps = chapRef.current
    if (!pub) return
    const fresh = emptyChapter(pub.id, chaps.length + 1)
    const next  = [...chaps, fresh]
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(fresh.id)
    scheduleSave()
  }, [scheduleSave])

  const deleteChapter = useCallback((id: string) => {
    const chaps = chapRef.current
    if (chaps.length <= 1) return
    deletedIdsRef.current.push(id)
    const next = chaps
      .filter(c => c.id !== id)
      .map((c, i) => ({ ...c, number: i + 1 }))
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(prev => prev === id ? (next[0]?.id ?? null) : prev)
    scheduleSave()
  }, [scheduleSave])

  // ── Block actions ─────────────────────────────────────────────────────────
  const mutateActiveChapter = useCallback((
    fn: (blocks: ContentBlock[]) => ContentBlock[]
  ) => {
    const targetId = activeChapterId
    setChapters(prev => {
      const next = prev.map(c => {
        if (c.id !== targetId) return c
        const blocks = fn(c.blocks)
        return {
          ...c,
          blocks,
          word_count:       calcWordCount(blocks),
          reading_time_min: calcReadingTime(blocks),
        }
      })
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [activeChapterId, scheduleSave])

  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    const nb: ContentBlock = { id: crypto.randomUUID(), type, content: '' }
    mutateActiveChapter(blocks => {
      if (!afterBlockId) return [...blocks, nb]
      const idx = blocks.findIndex(b => b.id === afterBlockId)
      if (idx === -1) return [...blocks, nb]
      const next = [...blocks]
      next.splice(idx + 1, 0, nb)
      return next
    })
  }, [mutateActiveChapter])

  const updateBlock = useCallback((
    blockId: string,
    content: string,
    meta?:   ContentBlock['meta']
  ) => {
    mutateActiveChapter(blocks =>
      blocks.map(b => b.id !== blockId ? b : {
        ...b,
        content,
        meta: meta !== undefined ? { ...b.meta, ...meta } : b.meta,
      })
    )
  }, [mutateActiveChapter])

  const deleteBlock = useCallback((blockId: string) => {
    mutateActiveChapter(blocks => blocks.filter(b => b.id !== blockId))
  }, [mutateActiveChapter])

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    mutateActiveChapter(blocks => {
      const idx = blocks.findIndex(b => b.id === blockId)
      if (idx === -1) return blocks
      if (direction === 'up'   && idx === 0)                  return blocks
      if (direction === 'down' && idx === blocks.length - 1)  return blocks
      const target = direction === 'up' ? idx - 1 : idx + 1
      const next   = [...blocks]
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return next
    })
  }, [mutateActiveChapter])

  // ── Publish ───────────────────────────────────────────────────────────────
  // Publishing the publication row alone does nothing for readers: the reader
  // only pulls chapters with status in ('published','locked'). So publishing
  // must also bulk-transition any chapter still sitting at 'draft' into the
  // right status for the pricing model (free/donation → published,
  // paid/school_license → locked, freemium → published up to freeChapters
  // then locked). Chapters the author has already set manually (status !==
  // 'draft') are left as-is so per-chapter overrides in the sidebar survive
  // a republish.
  const publishPublication = useCallback(async (): Promise<boolean> => {
    await forceSave()
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const pub = pubRef.current
    if (!pub) return false
    const now = new Date().toISOString()

    const nextChapters: VibeChapter[] = chapRef.current.map(c => {
      if (c.status !== 'draft') return c
      const status = chapterStatusForPricing(pub.pricing, c.number)
      return {
        ...c,
        status,
        published_at: status === 'published' ? now : c.published_at,
      }
    })

    const { error: pe } = await sb
      .from('vibe_publications')
      .update({ status: 'published', published_at: now })
      .eq('id', pub.id)
    if (pe) { setError(pe.message); return false }

    if (nextChapters.length > 0) {
      const { error: ce } = await sb
        .from('vibe_chapters')
        .upsert(
          nextChapters.map(c => ({ ...c, updated_at: now })),
          { onConflict: 'id' }
        )
      if (ce) { setError(ce.message); return false }
    }

    setChapters(nextChapters)
    chapRef.current = nextChapters
    setPublication(prev => prev ? { ...prev, status: 'published', published_at: now } : null)
    return true
  }, [forceSave])

  return {
    loading,
    saving,
    lastSaved,
    error,
    publication,
    chapters,
    activeChapterId,
    setActiveChapterId,
    updatePublication,
    updateChapterTitle,
    updateChapterStatus,
    addChapter,
    deleteChapter,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    publishPublication,
    forceSave,
  }
}
