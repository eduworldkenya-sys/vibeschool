'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  chapterDraftToInsert,
  chapterRowToDraft,
  publicationDraftToInsert,
  publicationRowToDraft,
  UNTITLED_DRAFT_TITLE,
} from '@/lib/publicationDraftCodec'
import { publishPublication as publishPublicationLifecycle, publishTextbook } from '@/lib/content-engine'
import { isMumbi2Publisher } from '@/lib/studioPublisherIdentity'
import {
  finalizePromotedMedia,
  parseDraftMediaRef,
  promoteDraftMedia,
  removeVibePressMedia,
  rollbackPromotedMedia,
  VIBEPRESS_COVER_BUCKET,
  VIBEPRESS_IMAGE_BUCKET,
  type PromotedMedia,
} from '@/lib/vibepressMedia'
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
const PUBLISHED_REVISION_MESSAGE = 'Published publications are locked against direct autosave. Create a governed revision before changing live content.'

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
  replaceActiveChapterBlocks: (blocks: ContentBlock[]) => void
  deleteBlock: (blockId: string) => void
  moveBlock: (blockId: string, direction: 'up' | 'down') => void
  publishPublication: (options?: { confirmedReadingOnlyTextbook?: boolean }) => Promise<boolean>
  forceSave: () => Promise<boolean>
}

export function usePublicationDraft(authorId: string, format: PublicationFormat, publicationId?: string, freshDraftId?: string): UsePublicationDraftResult {
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
        } else if (freshDraftId) {
          // Create uses an explicit URL-stable UUID. Reloads and Strict Mode
          // retries resolve the same draft rather than creating duplicates.
          const { data: existing, error: lookupError } = await sb.from('vibe_publications').select('*').eq('id', freshDraftId).eq('author_id', authorId).maybeSingle()
          if (lookupError) throw lookupError
          if (existing) {
            if (existing.format !== format || existing.status !== 'draft') throw new Error('This draft cannot be reused. Open it from Content Studio.')
            pub = publicationRowToDraft(existing)
          } else {
            const fresh = { ...emptyPublication(authorId, format), id: freshDraftId }
            const { data: inserted, error: insertError } = await sb.from('vibe_publications').insert(publicationDraftToInsert(fresh)).select('*').single()
            if (insertError) {
              // Only recover unique-key races for this exact owner-scoped draft.
              if (insertError.code !== '23505') throw insertError
              const { data: raced, error: racedError } = await sb.from('vibe_publications').select('*').eq('id', freshDraftId).eq('author_id', authorId).single()
              if (racedError || !raced || raced.format !== format || raced.status !== 'draft') throw racedError ?? new Error('Draft creation conflict')
              pub = publicationRowToDraft(raced)
            } else {
              pub = publicationRowToDraft(inserted)
            }
          }
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
        if (loadedChapters.length === 0 && pub.format !== 'vibetextbook' && pub.status === 'draft') {
          const first = emptyChapter(pub.id, 1)
          const { data: insertedChapter, error: chapterInsertError } = await sb.from('vibe_chapters').insert(chapterDraftToInsert(first)).select('*').single()
          if (chapterInsertError) throw chapterInsertError
          loadedChapters = [chapterRowToDraft(insertedChapter)]
        }
        if (!cancelled) {
          setPublication(pub)
          setChapters(loadedChapters)
          setActiveChapterId(loadedChapters[0]?.id ?? null)
          pubRef.current = pub
          chapRef.current = loadedChapters
          if (pub.status === 'published') setError(PUBLISHED_REVISION_MESSAGE)
        }
      } catch (reason) {
        if (!cancelled) {
          // PostgREST returns plain error objects rather than Error instances.
          // Never conceal a failed database operation behind "Load failed".
          const dbError = reason && typeof reason === 'object' ? reason as { message?: unknown; code?: unknown } : null
          const message = reason instanceof Error
            ? reason.message
            : typeof dbError?.message === 'string' ? dbError.message : 'Unable to load this draft. Check your connection and retry.'
          console.error('[PublicationDraft] load failed', {
            code: typeof dbError?.code === 'string' ? dbError.code : 'unknown',
            message,
          })
          setError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authorId, format, publicationId, freshDraftId])

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
      if (pub.status !== 'published') setError(null)
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

  const rejectPublishedMutation = useCallback((): boolean => {
    if (pubRef.current?.status !== 'published') return false
    setError(PUBLISHED_REVISION_MESSAGE)
    return true
  }, [])

  const updatePublication = useCallback((updates: Partial<VibePublication>) => {
    if (rejectPublishedMutation()) return
    setPublication(previous => {
      if (!previous) return null
      const next = { ...previous, ...updates }
      next.cbc_aligned = Boolean(next.cbc_subject?.trim() && next.cbc_grade?.trim())
      pubRef.current = next
      return next
    })
    scheduleSave()
  }, [rejectPublishedMutation, scheduleSave])

  const updateChapterTitle = useCallback((id: string, title: string) => {
    if (rejectPublishedMutation()) return
    setChapters(previous => {
      const next = previous.map(chapter => chapter.id === id ? { ...chapter, title } : chapter)
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [rejectPublishedMutation, scheduleSave])

  const updateChapterStatus = useCallback((id: string, status: ChapterStatus) => {
    if (rejectPublishedMutation()) return
    setChapters(previous => {
      const next = previous.map(chapter => chapter.id !== id ? chapter : { ...chapter, status, published_at: status === 'published' ? (chapter.published_at ?? new Date().toISOString()) : chapter.published_at })
      chapRef.current = next
      return next
    })
    scheduleSave()
  }, [rejectPublishedMutation, scheduleSave])

  const addChapter = useCallback(() => {
    if (rejectPublishedMutation()) return
    const pub = pubRef.current
    const currentChapters = chapRef.current
    if (!pub) return
    const fresh = emptyChapter(pub.id, currentChapters.length + 1)
    const next = [...currentChapters, fresh]
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(fresh.id)
    scheduleSave()
  }, [rejectPublishedMutation, scheduleSave])

  const deleteChapter = useCallback((id: string) => {
    if (rejectPublishedMutation()) return
    const currentChapters = chapRef.current
    if (currentChapters.length <= 1) return
    const deleted = currentChapters.find(chapter => chapter.id === id)
    if (deleted) {
      const sb = getSupabaseClient()
      for (const block of deleted.blocks) {
        if ((block.type === 'image' || block.type === 'diagram') && parseDraftMediaRef(block.content)) void removeVibePressMedia(sb, block.content)
      }
    }
    deletedIdsRef.current.push(id)
    const next = currentChapters.filter(chapter => chapter.id !== id).map((chapter, index) => ({ ...chapter, number: index + 1 }))
    setChapters(next)
    chapRef.current = next
    setActiveChapterId(previous => previous === id ? (next[0]?.id ?? null) : previous)
    scheduleSave()
  }, [rejectPublishedMutation, scheduleSave])

  const mutateActiveChapter = useCallback((fn: (blocks: ContentBlock[]) => ContentBlock[]) => {
    if (rejectPublishedMutation()) return
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
  }, [activeChapterId, rejectPublishedMutation, scheduleSave])

  const replaceActiveChapterBlocks = useCallback((blocks: ContentBlock[]) => {
    mutateActiveChapter(() => blocks)
  }, [mutateActiveChapter])

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

  const deleteBlock = useCallback((blockId: string) => {
    const currentChapter = chapRef.current.find(chapter => chapter.id === activeChapterId)
    const removed = currentChapter?.blocks.find(block => block.id === blockId)
    if (removed && (removed.type === 'image' || removed.type === 'diagram') && parseDraftMediaRef(removed.content)) {
      void removeVibePressMedia(getSupabaseClient(), removed.content)
    }
    mutateActiveChapter(blocks => blocks.filter(block => block.id !== blockId))
  }, [activeChapterId, mutateActiveChapter])

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

  const publishPublication = useCallback(async (options?: { confirmedReadingOnlyTextbook?: boolean }): Promise<boolean> => {
    const originalPub = pubRef.current
    const originalChapters = chapRef.current
    if (!originalPub) { setError('Publication is not available.'); return false }
    if (originalPub.status === 'published') { setError(PUBLISHED_REVISION_MESSAGE); return false }
    if (!originalPub.title?.trim() || originalPub.title.trim() === UNTITLED_DRAFT_TITLE) { setError('Enter a title before publishing.'); return false }
    if (originalPub.format === 'vibetextbook' && !originalPub.cbc_subject?.trim()) { setError('Select the CBC subject before publishing this textbook.'); return false }
    if (originalPub.format === 'vibetextbook' && !originalPub.cbc_grade?.trim()) { setError('Select the grade before publishing this textbook.'); return false }

    const sb = getSupabaseClient()
    const readingOnly = options?.confirmedReadingOnlyTextbook === true
    if (readingOnly) {
      if (originalPub.format !== 'vibetextbook') { setError('Checklist publishing is only supported for textbook reading content.'); return false }
      // UI confirmation is not authorization. Authenticate again before using
      // the existing owned textbook lifecycle, which also enforces auth.uid().
      const { data: authData, error: authError } = await sb.auth.getUser()
      if (authError || !authData.user || authData.user.id !== originalPub.author_id) {
        setError('The authenticated textbook author is required to publish.'); return false
      }
      const { data: profile, error: roleError } = await sb.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
      if (roleError || !isMumbi2Publisher(authData.user.id, profile?.role)) {
        setError('This checklist publishing pilot is limited to Mumbi2.'); return false
      }
      if (!originalChapters.some(chapter => chapter.blocks.some(block => !['image', 'diagram', 'question', 'video', 'audio'].includes(block.type) && Boolean(block.content?.trim())))) {
        setError('Add lesson content before publishing.'); return false
      }
    }
    const promoted: PromotedMedia[] = []
    const replacements = new Map<string, string>()
    let lifecycleSucceeded = false

    try {
      if (parseDraftMediaRef(originalPub.cover_url)) {
        const cover = await promoteDraftMedia(sb, originalPub.cover_url!, VIBEPRESS_COVER_BUCKET)
        if (cover) {
          promoted.push(cover)
          replacements.set(cover.sourceRef, cover.publicUrl)
        }
      }

      for (const chapter of originalChapters) {
        for (const block of chapter.blocks) {
          if ((block.type !== 'image' && block.type !== 'diagram') || !parseDraftMediaRef(block.content)) continue
          const image = await promoteDraftMedia(sb, block.content, VIBEPRESS_IMAGE_BUCKET)
          if (image) {
            promoted.push(image)
            replacements.set(image.sourceRef, image.publicUrl)
          }
        }
      }

      const preparedPub = replacements.size > 0
        ? { ...originalPub, cover_url: originalPub.cover_url ? (replacements.get(originalPub.cover_url) ?? originalPub.cover_url) : originalPub.cover_url }
        : originalPub
      const preparedChapters = replacements.size > 0
        ? originalChapters.map(chapter => ({
            ...chapter,
            blocks: chapter.blocks.map(block => replacements.has(block.content) ? { ...block, content: replacements.get(block.content)! } : block),
          }))
        : originalChapters

      setPublication(preparedPub)
      pubRef.current = preparedPub
      setChapters(preparedChapters)
      chapRef.current = preparedChapters

      const saved = await forceSave()
      if (!saved) throw new Error('Publication could not be saved before release.')

      const now = new Date().toISOString()
      // Textbook reading does not commission scored practice or a Teacher Guide.
      // Its existing owned lifecycle has no independent editorial approval step.
      // All other publication formats keep the canonical reviewed release route.
      if (readingOnly) await publishTextbook(sb, preparedPub.id)
      else await publishPublicationLifecycle(sb, preparedPub.id)
      lifecycleSucceeded = true

      const { data: persistedChapters, error: reloadError } = await sb.from('vibe_chapters').select('*').eq('publication_id', preparedPub.id).order('number', { ascending: true })
      if (!reloadError) {
        const nextChapters = (persistedChapters ?? []).map(chapterRowToDraft)
        setChapters(nextChapters)
        chapRef.current = nextChapters
      }
      const publishedPub = { ...preparedPub, status: 'published' as const, published_at: preparedPub.published_at ?? now }
      setPublication(publishedPub)
      pubRef.current = publishedPub
      setError(reloadError ? 'Publication is live, but the editor could not refresh its chapter state. Reload the page.' : null)

      try { await finalizePromotedMedia(sb, promoted) } catch { /* published asset is canonical; leftover private copies are safe to clean later */ }
      return true
    } catch (publishError) {
      if (lifecycleSucceeded) {
        setError(publishError instanceof Error ? `Publication is live. ${publishError.message}` : 'Publication is live, but the editor hit a post-release error.')
        return true
      }
      setPublication(originalPub)
      pubRef.current = originalPub
      setChapters(originalChapters)
      chapRef.current = originalChapters
      if (promoted.length > 0) {
        try { await persist() } catch { /* preserve the original error below */ }
        try { await rollbackPromotedMedia(sb, promoted) } catch { /* orphan cleanup can be retried independently */ }
      }
      const reason = publishError instanceof Error ? publishError.message : 'Publication failed'
      if (reason.includes('publication_release_approval_required') || reason.includes('publication_release_approval_stale')) {
        // Publisher-facing status comes from the current server, not a fictitious
        // human HQ approval or a fabricated machine-review receipt.
        const { data: reviewState, error: statusError } = await sb.rpc('ce_get_publication_auto_review_state', {
          p_publication_id: originalPub.id,
        })
        const machineReady = !statusError && reviewState && typeof reviewState === 'object'
          && !Array.isArray(reviewState) && 'machine_review_commissioned' in reviewState
          && reviewState.machine_review_commissioned === true
        setError(machineReady
          ? 'Independent automated review is still pending for this exact textbook version. No human sign-off is required. The draft is safe and private until review passes.'
          : 'Automated publishing review is not commissioned for this textbook. No human sign-off is required, but a qualified independent machine reviewer must be authorized before release. This draft is saved and private.')
      } else {
        setError(reason)
      }
      return false
    }
  }, [forceSave, persist])

  return { loading, saving, lastSaved, error, publication, chapters, activeChapterId, setActiveChapterId, updatePublication, updateChapterTitle, updateChapterStatus, addChapter, deleteChapter, addBlock, updateBlock, replaceActiveChapterBlocks, deleteBlock, moveBlock, publishPublication, forceSave }
}
