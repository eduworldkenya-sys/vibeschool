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
  publishPublication as publishPublicationLifecycle,
  unpublishPublication as unpublishPublicationLifecycle,
} from '@/lib/content-engine'
import {
  VibePublication,
  VibeChapter,
  ContentBlock,
  BlockType,
  ChapterStatus,
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

export function usePublicationDraft(authorId: string, format: PublicationFormat, publicationId?: string): UsePublicationDraftResult {
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
          const { data, error: loadError } = await sb.from('vibe_publications').select('*').eq('id', publicationId).single()
          if (loadError) throw loadError
          pub = publicationRowToDraft(data)
        } else {
          const { data: existing } = await sb.from('vibe_publications').select('*').eq('author_id', authorId).eq('format', format).eq('status', 'draft').order('updated_at', { ascending: false }).limit(1).maybeSingle()
          if (existing) {
            pub = publicationRowToDraft(existing)
          } else {
            const fresh = emptyPublication(authorId, format)
            const { data: inserted, error: insertError } = await sb.from('vibe_publications').insert(publicationDraftToInsert(fresh)).select('*').single()
            if (insertError) throw insertError
            pub = publicationRowToDraft(inserted)
          }
        }

        const { data: rawChapters, error: chaptersError } = await sb.from('vibe_chapters').select('*').eq('publication_id', pub.id).order('number', { ascending: true })
        if (chaptersError) throw chaptersError
        let loadedChapters: VibeChapter[] = (rawChapters ?? []).map(chapterRowToDraft)
        if (loadedChapters.length === 0) {
          const first = emptyChapter(pub.id, 1)
          const { data: insertedChapter, error: chapterInsertError } = await sb.from('vibe_chapters').insert(chapterDraftToInsert(first)).select('*').single()
          if (chapterInsertError) throw chapterInsertError
          loadedChapters = [chapterRowToDraft(insertedChapter)]
        }
        if (!cancelled) {
          setPublication(pub)
          setChapters(loadedChapters)
          setActiveChapterId(loadedChapters[0].id)
          pubRef.current = pub
          chapRef.current = loadedChapters
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authorId, format, publicationId])

  const persist = useCallback(async (): Promise<boolean> => {
    const pub = pubRef.current
    const currentChapters = chapRef.current
    const deletedIds = [...deletedIdsRef.current]
    if (!pub) return false
    setSaving(true)
    try {
      const sb = getSupabaseClient()
      const { error: publicationError } = await sb.from('vibe_publications').upsert(publicationDraftToInsert(pub, currentChapters.length), { onConflict: 'id' })
      if (publicationError) throw publicationError
      if (deletedIds.length > 0) {
        await sb.from('vibe_chapters').delete().in('id', deletedIds)
        deletedIdsRef.current = []
      }
      if (currentChapters.length > 0) {
        const { error: chapterError } = await sb.from('vibe_chapters').upsert(currentChapters.map(chapterDraftToInsert), { onConflict: 'id' })
        if (chapterError) throw chapterError
      }
      setLastSaved(new Date())
      setError(null)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed')
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
    setPublication(previous => {
      if (!previous) return null
      const next = { ...previous, ...updates }
      next.cbc_aligned = Boolean(next.cbc_subject?.trim() && next.cbc_grade?.trim())
      pubRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const updateChapterTitle = useCallback((id: string, title: string) => {
    setChapters(previous => {
      const next = previous.map(chapter => chapter.id === id ? { ...chapter, title } : chapter)
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const updateChapterStatus = useCallback((id: string, status: ChapterStatus) => {
    setChapters(previous => {
      const next = previous.map(chapter => chapter.id !== id ? chapter : { ...chapter, status, published_at: status === 'published' ? (chapter.published_at ?? new Date().toISOString()) : chapter.published_at })
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const addChapter = useCallback(() => {
    const pub = pubRef.current
    const currentChapters = chapRef.current
    if (!pub) return
    const fresh = emptyChapter(pub.id, currentChapters.length + 1)
    const next = [...currentChapters, fresh]
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(fresh.id)
    scheduleSave()
  }, [scheduleSave])

  const deleteChapter = useCallback((id: string) => {
    const currentChapters = chapRef.current
    if (currentChapters.length <= 1) return
    deletedIdsRef.current.push(id)
    const next = currentChapters.filter(chapter => chapter.id !== id).map((chapter, index) => ({ ...chapter, number: index + 1 }))
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(previous => previous === id ? (next[0]?.id ?? null) : previous)
    scheduleSave()
  }, [scheduleSave])

  const mutateActiveChapter = useCallback((fn: (blocks: ContentBlock[]) => ContentBlock[]) => {
    const targetId = activeChapterId
    setChapters(previous => {
      const next = previous.map(chapter => {
        if (chapter.id !== targetId) return chapter
        const blocks = fn(chapter.blocks)
        return { ...chapter, blocks, word_count: calcWordCount(blocks), reading_time_min: calcReadingTime(blocks) }
      })
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [activeChapterId, scheduleSave])

  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    const newBlock: ContentBlock = { id: crypto.randomUUID(), type, content: '' }
    mutateActiveChapter(blocks => {
      if (!afterBlockId) return [...blocks, newBlock]
      const index = blocks.findIndex(block => block.id === afterBlockId)
      if (index === -1) return [...blocks, newBlock]
      const next = [...blocks]
      next.splice(index + 1, 0, newBlock)
      return next
    })
  }, [mutateActiveChapter])

  const updateBlock = useCallback((blockId: string, content: string, meta?: ContentBlock['meta']) => {
    mutateActiveChapter(blocks => blocks.map(block => block.id !== blockId ? block : { ...block, content, meta: meta !== undefined ? { ...block.meta, ...meta } : block.meta }))
  }, [mutateActiveChapter])

  const deleteBlock = useCallback((blockId: string) => mutateActiveChapter(blocks => blocks.filter(block => block.id !== blockId)), [mutateActiveChapter])

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    mutateActiveChapter(blocks => {
      const index = blocks.findIndex(block => block.id === blockId)
      if (index === -1 || (direction === 'up' && index === 0) || (direction === 'down' && index === blocks.length - 1)) return blocks
      const target = direction === 'up' ? index - 1 : index + 1
      const next = [...blocks]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }, [mutateActiveChapter])

  const publishPublication = useCallback(async (): Promise<boolean> => {
    const pub = pubRef.current
    if (!pub) { setError('Publication is not available.'); return false }
    if (!pub.title?.trim()) { setError('Title is required before publishing.'); return false }
    if (pub.format === 'vibetextbook' && !pub.cbc_subject?.trim()) { setError('Select the CBC subject before publishing this textbook.'); return false }
    if (pub.format === 'vibetextbook' && !pub.cbc_grade?.trim()) { setError('Select the grade before publishing this textbook.'); return false }
    const saved = await forceSave()
    if (!saved) return false
    const sb = getSupabaseClient()
    const now = new Date().toISOString()
    try {
      await publishPublicationLifecycle(sb, pub.id)
      const { data: persistedChapters, error: reloadError } = await sb.from('vibe_chapters').select('*').eq('publication_id', pub.id).order('number', { ascending: true })
      if (reloadError) throw reloadError
      const nextChapters = (persistedChapters ?? []).map(chapterRowToDraft)
      setChapters(nextChapters)
      chapRef.current = nextChapters
    } catch (publishError) {
      try { await unpublishPublicationLifecycle(sb, pub.id) } catch { /* lifecycle RPC is transactional; this only compensates for post-publish reload failure */ }
      setError(publishError instanceof Error ? publishError.message : 'Publication failed')
      return false
    }
    setPublication(previous => previous ? { ...previous, status: 'published', published_at: previous.published_at ?? now } : null)
    setError(null)
    return true
  }, [forceSave])

  return { loading, saving, lastSaved, error, publication, chapters, activeChapterId, setActiveChapterId, updatePublication, updateChapterTitle, updateChapterStatus, addChapter, deleteChapter, addBlock, updateBlock, deleteBlock, moveBlock, publishPublication, forceSave }
}
