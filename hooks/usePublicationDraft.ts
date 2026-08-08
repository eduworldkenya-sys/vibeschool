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
  publishPublication,
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

export interface UsePublicationDraftResult {
  loading: boolean
  saving: boolean
  lastSaved: Date | null
  error: string | null
  publication: VibePublication | null
  chapters: VibeChapter[]
  activeChapterId: string | null
  setActiveChapterId: (id: string) => void
  updatePublication: (updates: Partial<VibePublication>) => void
  updateChapterTitle: (id: string, title: string) => void
  updateChapterStatus: (id: string, status: ChapterStatus) => void
  addChapter: () => void
  deleteChapter: (id: string) => void
  addBlock: (type: BlockType, afterBlockId?: string) => void
  updateBlock: (blockId: string, content: string, meta?: ContentBlock['meta']) => void
  deleteBlock: (blockId: string) => void
  moveBlock: (blockId: string, direction: 'up' | 'down') => void
  publishPublication: () => Promise<boolean>
  forceSave: () => Promise<boolean>
}

export function usePublicationDraft(
  authorId: string,
  format: PublicationFormat,
  publicationId?: string
): UsePublicationDraftResult {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publication, setPublication] = useState<VibePublication | null>(null)
  const [chapters, setChapters] = useState<VibeChapter[]>([])
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pubRef = useRef<VibePublication | null>(null)
  const chapRef = useRef<VibeChapter[]>([])
  const deletedIdsRef = useRef<string[]>([])

  pubRef.current = publication
  chapRef.current = chapters

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const sb = getSupabaseClient()
      try {
        let pub: VibePublication | null = null

        if (publicationId) {
          const { data, error: e } = await sb.from('vibe_publications').select('*').eq('id', publicationId).single()
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
            const { data: inserted, error: ie } = await sb.from('vibe_publications').insert(publicationDraftToInsert(fresh)).select('*').single()
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

        let chaps: VibeChapter[] = (rawChaps ?? []).map(chapterRowToDraft)
        if (chaps.length === 0) {
          const first = emptyChapter(pub.id, 1)
          const { data: ic, error: ice } = await sb.from('vibe_chapters').insert(chapterDraftToInsert(first)).select('*').single()
          if (ice) throw ice
          chaps = [chapterRowToDraft(ic)]
        }

        if (!cancelled) {
          setPublication(pub)
          setChapters(chaps)
          setActiveChapterId(chaps[0].id)
          pubRef.current = pub
          chapRef.current = chaps
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authorId, format, publicationId])

  const persist = useCallback(async (): Promise<boolean> => {
    const pub = pubRef.current
    const chaps = chapRef.current
    const delIds = [...deletedIdsRef.current]
    if (!pub) return false
    setSaving(true)
    try {
      const sb = getSupabaseClient()
      const { error: pe } = await sb.from('vibe_publications').upsert(publicationDraftToInsert(pub, chaps.length), { onConflict: 'id' })
      if (pe) throw pe

      if (delIds.length > 0) {
        const { error: de } = await sb.from('vibe_chapters').delete().in('id', delIds)
        if (de) throw de
        deletedIdsRef.current = []
      }

      if (chaps.length > 0) {
        const { error: ce } = await sb.from('vibe_chapters').upsert(chaps.map(chapterDraftToInsert), { onConflict: 'id' })
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

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

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
    const pub = pubRef.current
    const chaps = chapRef.current
    if (!pub) return
    const fresh = emptyChapter(pub.id, chaps.length + 1)
    const next = [...chaps, fresh]
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(fresh.id)
    scheduleSave()
  }, [scheduleSave])

  const deleteChapter = useCallback((id: string) => {
    const chaps = chapRef.current
    if (chaps.length <= 1) return
    deletedIdsRef.current.push(id)
    const next = chaps.filter(c => c.id !== id).map((c, i) => ({ ...c, number: i + 1 }))
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(prev => prev === id ? (next[0]?.id ?? null) : prev)
    scheduleSave()
  }, [scheduleSave])

  const mutateActiveChapter = useCallback((fn: (blocks: ContentBlock[]) => ContentBlock[]) => {
    const targetId = activeChapterId
    setChapters(prev => {
      const next = prev.map(c => {
        if (c.id !== targetId) return c
        const blocks = fn(c.blocks)
        return { ...c, blocks, word_count: calcWordCount(blocks), reading_time_min: calcReadingTime(blocks) }
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

  const updateBlock = useCallback((blockId: string, content: string, meta?: ContentBlock['meta']) => {
    mutateActiveChapter(blocks => blocks.map(b => b.id !== blockId ? b : {
      ...b,
      content,
      meta: meta !== undefined ? { ...b.meta, ...meta } : b.meta,
    }))
  }, [mutateActiveChapter])

  const deleteBlock = useCallback((blockId: string) => {
    mutateActiveChapter(blocks => blocks.filter(b => b.id !== blockId))
  }, [mutateActiveChapter])

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    mutateActiveChapter(blocks => {
      const idx = blocks.findIndex(b => b.id === blockId)
      if (idx === -1 || (direction === 'up' && idx === 0) || (direction === 'down' && idx === blocks.length - 1)) return blocks
      const target = direction === 'up' ? idx - 1 : idx + 1
      const next = [...blocks]
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return next
    })
  }, [mutateActiveChapter])

  const publishPublicationAction = useCallback(async (): Promise<boolean> => {
    const pub = pubRef.current
    if (!pub) { setError('Publication is not available.'); return false }
    if (!pub.title?.trim()) { setError('Title is required before publishing.'); return false }
    if (pub.format === 'vibetextbook' && !pub.cbc_subject?.trim()) { setError('Select the curriculum subject before publishing this textbook.'); return false }
    if (pub.format === 'vibetextbook' && !pub.cbc_grade?.trim()) { setError('Select the grade or form before publishing this textbook.'); return false }

    const saved = await forceSave()
    if (!saved) return false

    const sb = getSupabaseClient()
    const now = new Date().toISOString()

    try {
      await publishPublication(sb, pub.id)

      const { data: refreshedChapters, error: chapterReadError } = await sb
        .from('vibe_chapters')
        .select('*')
        .eq('publication_id', pub.id)
        .order('number', { ascending: true })
      if (chapterReadError) throw chapterReadError

      const authoritative = (refreshedChapters ?? []).map(chapterRowToDraft)
      setChapters(authoritative)
      chapRef.current = authoritative
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Publication failed')
      return false
    }

    setPublication(prev => {
      if (!prev) return null
      const next = { ...prev, status: 'published' as const, published_at: prev.published_at ?? now }
      pubRef.current = next
      return next
    })
    setError(null)
    return true
  }, [forceSave])

  return {
    loading, saving, lastSaved, error, publication, chapters, activeChapterId,
    setActiveChapterId, updatePublication, updateChapterTitle, updateChapterStatus,
    addChapter, deleteChapter, addBlock, updateBlock, deleteBlock, moveBlock,
    publishPublication: publishPublicationAction, forceSave,
  }
}
