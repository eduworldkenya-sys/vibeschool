'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  listChapterOutcomeLinks,
  listVerifiedCurriculumOutcomes,
  replaceChapterOutcomeLinks,
  ContentEngineError,
  type CurriculumLearningOutcome,
} from '@/lib/content-engine'

const SURF   = '#111827'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

interface Props {
  isOpen:         boolean
  onClose:        () => void
  publicationId:  string
  chapterId:      string
  chapterLabel:   string
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
  isOpen, onClose, publicationId, chapterId, chapterLabel, ensureChapterSaved,
}: Props) {
  const [ready,      setReady]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [outcomes,   setOutcomes]   = useState<CurriculumLearningOutcome[]>([])
  const [selectedIds,setSelectedIds]= useState<Set<string>>(new Set())

  const load = useCallback(async (searchTerm: string) => {
    setError(null)
    const client = getSupabaseClient()

    try {
      const persisted = await ensureChapterSaved()
      if (!persisted) {
        setError('Could not save this chapter yet — try again in a moment.')
        return
      }

      const [outcomeRows, linkRows] = await Promise.all([
        listVerifiedCurriculumOutcomes(client, {
          search: searchTerm || undefined,
          limit: 100,
        }),
        listChapterOutcomeLinks(client, chapterId),
      ])

      setOutcomes(outcomeRows)
      setSelectedIds(new Set(linkRows.map(link => link.outcome_id)))
      setReady(true)
    } catch (err) {
      setError(
        err instanceof ContentEngineError
          ? err.message
          : 'Could not load curriculum outcomes.',
      )
    }
  }, [chapterId, ensureChapterSaved])

  useEffect(() => {
    if (!isOpen) {
      setReady(false)
      return
    }
    void load(search)
    // Only re-run on open/chapter change here — search re-fetch is debounced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chapterId])

  useEffect(() => {
    if (!isOpen || !ready) return
    const t = setTimeout(() => { void load(search) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300 }} />
      <div style={{
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
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none',
            borderRadius: '50%', width: 28, height: 28,
            color: TEXT, fontSize: 14, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search verified outcomes…"
            style={{
              width: '100%', background: CARD,
              border: '1px solid ' + BORDER, borderRadius: 10,
              padding: '10px 12px', color: TEXT, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            margin: '0 16px 12px', padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, fontSize: 12, color: '#ef4444',
          }}>{error}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
          {!ready ? (
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
                  onClick={() => toggle(outcome.id)}
                  style={{
                    background: on ? 'rgba(204,255,0,0.08)' : CARD,
                    border: '1px solid ' + (on ? 'rgba(204,255,0,0.25)' : BORDER),
                    borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                    cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                    border: '1.5px solid ' + (on ? ACCENT : MUTED),
                    background: on ? ACCENT : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#090D16', fontWeight: 900,
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
              background: saving || !ready ? 'rgba(204,255,0,0.5)' : ACCENT,
              color: '#090D16', border: 'none', borderRadius: 10,
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
