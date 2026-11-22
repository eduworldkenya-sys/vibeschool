'use client'

import React, { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  listChapterOutcomeLinks,
  listVerifiedCurriculumOutcomes,
  replaceChapterOutcomeLinks,
  ContentEngineError,
  type CurriculumLearningOutcome,
} from '@/lib/content-engine'

const SURF   = 'var(--publication-surface, #111827)'
const CARD   = 'var(--publication-surface, #1a2235)'
const ACCENT = 'var(--publication-accent, #CCFF00)'
const TEXT   = 'var(--publication-text, #ffffff)'
const MUTED  = 'var(--publication-muted, rgba(255,255,255,0.4))'
const BORDER = 'var(--publication-border, rgba(255,255,255,0.06))'

interface Props {
  isOpen:         boolean
  onClose:        () => void
  publicationId:  string
  chapterId:      string
  chapterLabel:   string
  /**
   * The chapter's bridged curriculum identity (vibe_chapters.curriculum_id /
   * sub_strand_id — real FK columns, not a guessed grade/subject label
   * match). When present, outcome discovery is scoped to it. When absent
   * (chapter not yet bridged to a curriculum strand), discovery falls back
   * to global search and the drawer says so rather than silently showing
   * unrelated grades/subjects as if they were scoped.
   */
  curriculumId:   string | null
  subStrandId:    string | null
  /**
   * Chapter/block saves are debounced client-side (see usePublicationDraft).
   * A brand-new chapter's id only becomes valid in the DB once that save
   * lands, and outcome links have a hard FK to vibe_chapters. Callers must
   * pass a forceSave that resolves only once the chapter is confirmed
   * persisted — the drawer will not query or write until that resolves.
   */
  ensureChapterSaved: () => Promise<boolean>
}

export function OutcomeSelector({
  isOpen, onClose, publicationId, chapterId, chapterLabel,
  curriculumId, subStrandId, ensureChapterSaved,
}: Props) {
  const [ready,      setReady]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [outcomes,   setOutcomes]   = useState<CurriculumLearningOutcome[]>([])
  const [loadingOutcomes, setLoadingOutcomes] = useState(true)
  const [selectedIds,setSelectedIds]= useState<Set<string>>(new Set())

  const isScoped = Boolean(curriculumId || subStrandId)

  // Initialize the saved links independently of the search query so typing
  // never discards selections that have not been saved yet.
  useEffect(() => {
    setReady(false)
    setLoadingOutcomes(true)
    if (!isOpen) {
      setSearch('')
      return
    }

    let cancelled = false
    setError(null)

    async function initializeSelection() {
      try {
        const client = getSupabaseClient()
        const persisted = await ensureChapterSaved()
        if (cancelled) return
        if (!persisted) {
          setError('Could not save this chapter yet — try again in a moment.')
          return
        }

        const links = await listChapterOutcomeLinks(client, chapterId)
        if (cancelled) return
        setSelectedIds(new Set(links.map(link => link.outcome_id)))
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ContentEngineError ? err.message : 'Could not load curriculum outcomes.')
        }
      }
    }

    void initializeSelection()
    return () => { cancelled = true }
  }, [isOpen, chapterId, ensureChapterSaved])

  useEffect(() => {
    if (!isOpen || !ready) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setError(null)
      try {
        const client = getSupabaseClient()
        const rows = await listVerifiedCurriculumOutcomes(client, {
          curriculumId: curriculumId ?? undefined,
          subStrandId: subStrandId ?? undefined,
          search: search || undefined,
          limit: 100,
        })
        if (!cancelled) setOutcomes(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ContentEngineError ? err.message : 'Could not load curriculum outcomes.')
        }
      } finally {
        if (!cancelled) setLoadingOutcomes(false)
      }
    }, search ? 350 : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, ready, curriculumId, subStrandId, search])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const toggle = (outcomeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(outcomeId)) next.delete(outcomeId)
      else next.add(outcomeId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const client = getSupabaseClient()
      await replaceChapterOutcomeLinks(client, {
        publicationId,
        chapterId,
        outcomeIds: Array.from(selectedIds),
      })
      onClose()
    } catch (err) {
      setError(
        err instanceof ContentEngineError
          ? err.message
          : 'Could not save outcome links.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--publication-scrim, rgba(0,0,0,0.6))', zIndex: 300 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Curriculum outcomes for ${chapterLabel}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 320, maxWidth: '90vw', background: SURF, zIndex: 310,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid ' + BORDER,
          animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}' }} />

        <div style={{
          padding: '16px', borderBottom: '1px solid ' + BORDER,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>🎯 Curriculum Outcomes</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{chapterLabel}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'var(--publication-border, rgba(255,255,255,0.06))', border: 'none',
            borderRadius: '50%', width: 28, height: 28,
            color: TEXT, fontSize: 14, cursor: 'pointer',
          }}>✕</button>
        </div>

        {!isScoped && (
          <div style={{
            margin: '12px 16px 0', padding: '8px 10px',
            background: 'var(--publication-warning-soft, rgba(255,176,32,0.08))', border: '1px solid var(--publication-warning-border, rgba(255,176,32,0.2))',
            borderRadius: 8, fontSize: 11, color: 'var(--publication-warning, #FFB020)', lineHeight: 1.4,
          }}>
            This chapter isn&apos;t linked to a curriculum strand yet, so this is showing verified outcomes from every grade and subject. Bridge the chapter to narrow it down.
          </div>
        )}

        <div style={{ padding: '12px 16px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search verified outcomes…"
            aria-label="Search verified outcomes"
            style={{
              width: '100%', background: CARD,
              border: '1px solid ' + BORDER, borderRadius: 10,
              padding: '10px 12px', color: TEXT, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div role="alert" style={{
            margin: '0 16px 12px', padding: '8px 10px',
            background: 'var(--publication-danger-soft, rgba(239,68,68,0.1))', border: '1px solid var(--publication-danger-border, rgba(239,68,68,0.2))',
            borderRadius: 8, fontSize: 12, color: 'var(--publication-danger, #ef4444)',
          }}>{error}</div>
        )}


        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
          {!ready || loadingOutcomes ? (
            <div style={{ color: MUTED, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
          ) : outcomes.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              No verified outcomes match. Verified outcomes are curated separately from author-claimed ones.
            </div>
          ) : (
            outcomes.map(outcome => {
              const on = selectedIds.has(outcome.id)
              return (
                <div
                  key={outcome.id}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => toggle(outcome.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(outcome.id)
                    }
                  }}
                  style={{
                    background: on ? 'var(--publication-surface, rgba(204,255,0,0.08))' : CARD,
                    border: '1px solid ' + (on ? 'var(--publication-accent-border, rgba(204,255,0,0.25))' : BORDER),
                    borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                    cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <div aria-hidden="true" style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                    border: '1.5px solid ' + (on ? ACCENT : MUTED),
                    background: on ? ACCENT : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'var(--publication-on-accent, #090D16)', fontWeight: 900,
                  }}>{on ? '✓' : ''}</div>
                  <div>
                    <div style={{ fontSize: 12.5, color: TEXT, lineHeight: 1.4 }}>{outcome.outcome_text}</div>
                    {outcome.outcome_code && (
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{outcome.outcome_code}</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid ' + BORDER }}>
          <button
            onClick={handleSave}
            disabled={saving || !ready}
            style={{
              width: '100%', padding: 12,
              background: saving || !ready ? 'var(--publication-accent-disabled, rgba(204,255,0,0.5))' : ACCENT,
              color: 'var(--publication-on-accent, #090D16)', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 800,
              cursor: saving || !ready ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : `Save ${selectedIds.size ? `(${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}
