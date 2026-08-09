'use client'

import React from 'react'
import { VibeChapter, ChapterStatus, PublicationFormat, FORMAT_META } from '@/lib/publishTypes'

const SURF = '#111827'
const CARD = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

const STATUS_META: Record<ChapterStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: MUTED },
  published: { label: 'Published', color: ACCENT },
  locked: { label: 'Locked', color: '#FFB020' },
}

interface Props {
  format: PublicationFormat
  chapters: VibeChapter[]
  activeChapterId: string | null
  isOpen: boolean
  onClose: () => void
  onSelectChapter: (id: string) => void
  onAddChapter: () => void
  onDeleteChapter: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onStatusChange: (id: string, status: ChapterStatus) => void
}

export function ChapterSidebar({ format, chapters, activeChapterId, isOpen, onClose, onSelectChapter, onAddChapter, onDeleteChapter, onTitleChange, onStatusChange }: Props) {
  const meta = FORMAT_META[format]
  const lifecycleOwnedByPublication = format === 'vibetextbook' || format === 'ebook'

  if (!isOpen) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 300, background: SURF, zIndex: 210, display: 'flex', flexDirection: 'column', borderRight: '1px solid ' + BORDER, animation: 'slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}' }} />
        <div style={{ padding: '16px', borderBottom: '1px solid ' + BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{meta.icon} {meta.chapterPlural}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: TEXT, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        {lifecycleOwnedByPublication && (
          <div style={{ margin: '12px 12px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.15)', color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
            Unit access follows this publication’s Publish/Unpublish action and pricing. Individual units cannot be put live independently.
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {chapters.map(chapter => {
            const active = chapter.id === activeChapterId
            return (
              <div key={chapter.id} style={{ background: active ? 'rgba(204,255,0,0.08)' : CARD, border: '1px solid ' + (active ? 'rgba(204,255,0,0.25)' : BORDER), borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }}>
                <div onClick={() => { onSelectChapter(chapter.id); onClose() }} style={{ fontSize: 11, color: active ? ACCENT : MUTED, fontWeight: 700, marginBottom: 4 }}>{meta.chapterLabel} {chapter.number}</div>
                <input value={chapter.title || ''} onChange={event => onTitleChange(chapter.id, event.target.value)} placeholder={`${meta.chapterLabel} title`} onClick={event => event.stopPropagation()} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontSize: 13, fontWeight: 600, padding: 0, boxSizing: 'border-box' }} />
                {lifecycleOwnedByPublication ? (
                  <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid ' + STATUS_META[chapter.status].color, color: STATUS_META[chapter.status].color }}>
                    {STATUS_META[chapter.status].label}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {(['draft', 'published', 'locked'] as ChapterStatus[]).map(status => {
                      const on = chapter.status === status
                      return <button key={status} onClick={event => { event.stopPropagation(); onStatusChange(chapter.id, status) }} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? STATUS_META[status].color : BORDER), background: on ? STATUS_META[status].color + '1a' : 'transparent', color: on ? STATUS_META[status].color : MUTED }}>{STATUS_META[status].label}</button>
                    })}
                  </div>
                )}
                {chapters.length > 1 && <button onClick={event => { event.stopPropagation(); onDeleteChapter(chapter.id) }} style={{ marginTop: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>Delete</button>}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid ' + BORDER }}>
          <button onClick={onAddChapter} style={{ width: '100%', padding: '10px', background: ACCENT, color: '#090D16', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>+ New {meta.chapterLabel}</button>
        </div>
      </div>
    </>
  )
}
