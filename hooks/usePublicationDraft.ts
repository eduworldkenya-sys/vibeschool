'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  chapterDraftToInsert,
  chapterRowToDraft,
  publicationDraftToInsert,
  publicationRowToDraft,
} from '@/lib/publicationDraftCodec'
import {
  publishTextbook,
  unpublishTextbook,
} from '@/lib/content-engine'
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
  forceSave:            () => Promise<boolean>
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
      const sb = getSupabaseClient()
      try {
        let pub: VibePublication | null = null

        if (publicationId) {
          const { data, error: e } = await sb
            .from('vibe_publications')
            .select('*')
            .eq('id', publicationId)
            .single()
          if (e) throw e
          pub = publicationRowToDraft(data)
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
            pub = publicationRowToDraft(existing)
          } else {
            const fresh = emptyPublication(authorId, format)
            const { data: inserted, error: ie } = await sb
              .from('vibe_publications')
              .insert(
                publicationDraftToInsert(fresh),
              )
              .select('*')
              .single()
            if (ie) throw ie
            pub = publicationRowToDraft(inserted)
          }
        }

        const { data: rawChaps, error: ce } = await sb
          .from('vibe_chapters')
          .select('*')
          .eq('publication_id', pub.id)
          .order('number', { ascending: true })
        if (ce) throw ce

        let chaps: VibeChapter[] =
          (rawChaps ?? []).map(chapterRowToDraft)

        if (chaps.length === 0) {
          const first = emptyChapter(pub.id, 1)
          const { data: ic, error: ice } = await sb
            .from('vibe_chapters')
            .insert(
              chapterDraftToInsert(first),
            )
            .select('*')
            .single()
          if (ice) throw ice
          chaps = [chapterRowToDraft(ic)]
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
  const persist = useCallback(async (): Promise<boolean> => {
    const pub   = pubRef.current
    const chaps = chapRef.current
    const delIds = [...deletedIdsRef.current]
    if (!pub) return false
    setSaving(true)
    try {
      const sb = getSupabaseClient()
      const { error: pe } = await sb
        .from('vibe_publications')
        .upsert(
          publicationDraftToInsert(pub, chaps.length),
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
            chaps.map(chapterDraftToInsert),
            { onConflict: 'id' }
          )
        if (ce) throw ce
      }
      setLastSaved(new Date())
      setError(null)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(persist, AUTOSAVE_MS)
  }, [persist])

  const forceSave = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) clearTimeout(timerRef.current)
    return persist()
  }, [persist])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── Publication actions ───────────────────────────────────────────────────
  const updatePublication = useCallback((updates: Partial<VibePublication>) => {
    setPublication(prev => {
      if (!prev) return null
      const next = { ...prev, ...updates }
      next.cbc_aligned = Boolean(next.cbc_subject?.trim() && next.cbc_grade?.trim())
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
  const publishPublication = useCallback(async (): Promise<boolean> => {
    const saved = await forceSave()
    if (!saved) return false

    const sb = getSupabaseClient()
    const pub = pubRef.current
    if (!pub) return false

    const now = new Date().toISOString()
    const isTextbook = pub.format === 'vibetextbook'
    let lifecycleApplied = false

    const nextChapters: VibeChapter[] = chapRef.current.map(c => {
      if (c.status !== 'draft') return c
      const status = chapterStatusForPricing(pub.pricing, c.number)
      return {
        ...c,
        status,
        published_at: status === 'published' ? now : c.published_at,
      }
    })

    try {
      if (isTextbook) {
        await publishTextbook(sb, pub.id)
      } else {
        const { error: publicationError } = await sb
          .from('vibe_publications')
          .update({
            status: 'published',
            published_at: pub.published_at ?? now,
          })
          .eq('id', pub.id)

        if (publicationError) {
          throw publicationError
        }
      }

      lifecycleApplied = true

      if (nextChapters.length > 0) {
        const { error: chapterError } = await sb
          .from('vibe_chapters')
          .upsert(
            nextChapters.map(chapterDraftToInsert),
            { onConflict: 'id' },
          )

        if (chapterError) {
          throw chapterError
        }
      }
    } catch (publishError) {
      const publishMessage =
        publishError instanceof Error
          ? publishError.message
          : 'Publication failed'

      if (lifecycleApplied) {
        try {
          if (isTextbook) {
            await unpublishTextbook(sb, pub.id)
          } else {
            const { error: rollbackError } = await sb
              .from('vibe_publications')
              .update({
                status: 'draft',
                published_at: null,
              })
              .eq('id', pub.id)

            if (rollbackError) {
              throw rollbackError
            }
          }
        } catch (rollbackError) {
          const rollbackMessage =
            rollbackError instanceof Error
              ? rollbackError.message
              : 'rollback failed'

          setError(
            `${publishMessage}. Publication rollback also failed: ` +
            rollbackMessage,
          )
          return false
        }
      }

      setError(publishMessage)
      return false
    }

    setChapters(nextChapters)
    chapRef.current = nextChapters
    setPublication(prev => prev ? { ...prev, status: 'published', published_at: prev.published_at ?? now } : null)
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
