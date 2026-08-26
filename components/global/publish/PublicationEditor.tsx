"use client";

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePublicationDraft } from '@/hooks/usePublicationDraft'
import { ContentBlockEditor } from '@/components/global/publish/ContentBlockEditor'
import { BlockToolbar } from '@/components/global/publish/BlockToolbar'
import { ChapterSidebar } from '@/components/global/publish/ChapterSidebar'
import { OutcomeSelector } from '@/components/global/publish/OutcomeSelector'
import { PublicationSetupDrawer } from '@/components/global/publish/PublicationSetupDrawer'
import { FORMAT_META, PublicationFormat, PublicationGenre } from '@/lib/publishTypes'

const BG     = '#090D16'
const SURF   = '#111827'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

const GENRES: { value: PublicationGenre; label: string }[] = [
  { value: 'fiction',     label: 'Fiction'    },
  { value: 'non_fiction', label: 'Non-Fiction' },
  { value: 'academic',    label: 'Academic'   },
  { value: 'self_help',   label: 'Self Help'  },
  { value: 'children',    label: 'Children'   },
  { value: 'religion',    label: 'Religion'   },
  { value: 'poetry',      label: 'Poetry'     },
  { value: 'magazine',    label: 'Magazine'   },
  { value: 'other',       label: 'Other'      },
]

interface Props {
  authorId:       string
  format:         PublicationFormat
  publicationId?: string
}

export function PublicationEditor({ authorId, format, publicationId }: Props) {
  const router = useRouter()
  const meta   = FORMAT_META[format]

  const {
    loading, saving, lastSaved, error,
    publication, chapters, activeChapterId,
    setActiveChapterId, updatePublication,
    updateChapterTitle, updateChapterStatus, addChapter, deleteChapter,
    addBlock, updateBlock, deleteBlock, moveBlock,
    publishPublication, forceSave,
  } = usePublicationDraft(authorId, format, publicationId)

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [setupOpen,      setSetupOpen]      = useState(false)
  const [outcomesOpen,   setOutcomesOpen]   = useState(false)
  const [publishing,     setPublishing]     = useState(false)
  const [titleError,     setTitleError]     = useState(false)

  // Quick setup modal state
  const [quickSetup,     setQuickSetup]     = useState(false)
  const [quickTitle,     setQuickTitle]     = useState('')
  const [quickGenre,     setQuickGenre]     = useState<PublicationGenre>('other')
  const [quickTitleErr,  setQuickTitleErr]  = useState(false)

  const firstBlockFocused = useRef(false)
  const titleInputRef     = useRef<HTMLInputElement>(null)

  // Auto-open quick setup on first load for new publications
  useEffect(() => {
    if (!loading && publication && !publicationId && !publication.title) {
      setQuickSetup(true)
    }
  }, [loading, publication, publicationId])

  // Auto-focus first paragraph block after load
  useEffect(() => {
    if (!loading && chapters.length > 0 && !firstBlockFocused.current && !publicationId) {
      const first = chapters[0]?.blocks[0]
      if (first) {
        firstBlockFocused.current = true
        setFocusedBlockId(first.id)
      }
    }
  }, [loading, chapters, publicationId])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void forceSave()
    }
    window.addEventListener('visibilitychange', onHide)
    return () => window.removeEventListener('visibilitychange', onHide)
  }, [forceSave])

  const saveLabel = saving
    ? 'Saving…'
    : lastSaved
    ? 'Saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Draft'

  const handlePublish = async () => {
    if (!publication?.title?.trim()) {
      setTitleError(true)
      titleInputRef.current?.focus()
      return
    }

    const textbookAlignmentMissing =
      publication.format === 'vibetextbook' &&
      (
        !publication.cbc_subject?.trim() ||
        !publication.cbc_grade?.trim()
      )

    if (textbookAlignmentMissing) {
      setTitleError(false)
      setSetupOpen(true)
      return
    }

    setTitleError(false)
    setPublishing(true)
    const ok = await publishPublication()
    setPublishing(false)
    if (ok) router.push('/global/creator/' + authorId)
  }

  const handleQuickSetupDone = () => {
    if (!quickTitle.trim()) { setQuickTitleErr(true); return }
    setQuickTitleErr(false)
    updatePublication({ title: quickTitle.trim(), genre: quickGenre })
    setQuickSetup(false)
  }

  const activeChapter = chapters.find(c => c.id === activeChapterId) ?? null

  if (loading) return (
    <div style={{
      minHeight: '100dvh', background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid ' + ACCENT, borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
      <span style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>Loading editor…</span>
    </div>
  )

  if (!publication) return (
    <div style={{
      minHeight: '100dvh', background: BG, color: TEXT,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: SURF,
        border: '1px solid ' + BORDER, borderRadius: 16,
        padding: 24, textAlign: 'center', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Editor could not open</h2>
        <p style={{ margin: '0 0 18px', color: '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>
          {error || 'The textbook could not be loaded.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: ACCENT, color: BG, border: 'none', borderRadius: 10,
              padding: '10px 16px', fontWeight: 800, cursor: 'pointer',
            }}
          >Retry</button>
          <button
            onClick={() => router.back()}
            style={{
              background: 'transparent', color: TEXT, border: '1px solid ' + BORDER,
              borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer',
            }}
          >Back</button>
        </div>
      </div>
    </div>
  )

  const publishedReadOnly = publication.status === 'published'

  return (
    <div style={{
      minHeight: '100dvh', background: BG,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>

      {/* ── Quick Setup Modal ── */}
      {quickSetup && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 'calc(100% - 40px)', maxWidth: 420,
            background: SURF, borderRadius: 20,
            padding: '28px 24px', zIndex: 510,
            border: '1px solid ' + BORDER,
            boxSizing: 'border-box',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>{meta.icon}</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 4px', textAlign: 'center' }}>
              New {meta.label}
            </h2>
            <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', margin: '0 0 24px' }}>
              Quick setup — takes 10 seconds
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                TITLE
              </div>
              <input
                autoFocus
                value={quickTitle}
                onChange={e => { setQuickTitle(e.target.value); setQuickTitleErr(false) }}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickSetupDone() }}
                placeholder={`e.g. "How to Pass KCSE Maths"`}
                style={{
                  width: '100%', background: '#1a2235',
                  border: '1px solid ' + (quickTitleErr ? '#ef4444' : BORDER),
                  borderRadius: 10, padding: '12px 14px',
                  color: TEXT, fontSize: 15, outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: quickTitleErr ? '0 0 0 3px rgba(239,68,68,0.2)' : 'none',
                }}
              />
              {quickTitleErr && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Title is required</div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                GENRE
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {GENRES.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setQuickGenre(g.value)}
                    style={{
                      padding: '6px 14px', borderRadius: 24,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (quickGenre === g.value ? ACCENT : BORDER),
                      background: quickGenre === g.value ? 'rgba(204,255,0,0.1)' : '#1a2235',
                      color: quickGenre === g.value ? ACCENT : MUTED,
                    }}
                  >{g.label}</button>
                ))}
              </div>
            </div>

            <button
              onClick={handleQuickSetupDone}
              style={{
                width: '100%', padding: 14,
                background: ACCENT, color: '#090D16',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Start Writing →
            </button>
          </div>
        </>
      )}

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(9,13,22,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid ' + BORDER,
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => router.back()} style={{
            fontSize: 22, color: TEXT, cursor: 'pointer',
            fontWeight: 300, lineHeight: 1, padding: '4px 8px',
          }}>‹</div>
          <button onClick={() => setSidebarOpen(true)} style={{
            background: SURF, border: '1px solid ' + BORDER,
            borderRadius: 8, padding: '5px 10px',
            color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{meta.icon}</span>
            <span>{chapters.length} {meta.chapterPlural}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: saving ? ACCENT : MUTED, fontWeight: 600 }}>
            {publishedReadOnly ? 'Published · read only' : saveLabel}
          </span>
          <button
            onClick={() => { if (!publishedReadOnly) setSetupOpen(true) }}
            disabled={publishedReadOnly}
            style={{
              background: SURF, border: '1px solid ' + BORDER,
              borderRadius: 8, padding: '6px 12px',
              color: publishedReadOnly ? MUTED : TEXT, fontSize: 12, fontWeight: 700,
              cursor: publishedReadOnly ? 'default' : 'pointer',
            }}
          >
            {publishedReadOnly ? 'Live' : 'Setup'}
          </button>
          <button onClick={handlePublish} disabled={publishing || publishedReadOnly} style={{
            background: publishing || publishedReadOnly ? 'rgba(204,255,0,0.35)' : ACCENT,
            color: '#090D16', border: 'none', borderRadius: 10,
            padding: '7px 16px', fontSize: 13, fontWeight: 800,
            cursor: publishing || publishedReadOnly ? 'default' : 'pointer',
          }}>
            {publishedReadOnly ? 'Published' : publishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          padding: '10px 16px', fontSize: 13, color: '#ef4444',
        }}>{error}</div>
      )}

      {/* Main */}
      <main style={{
        flex: 1, padding: '16px',
        paddingBottom: 160,
        maxWidth: 680, margin: '0 auto',
        width: '100%', boxSizing: 'border-box',
      }}>

        {/* Publication title — with inline error highlight */}
        <input
          ref={titleInputRef}
          value={publication.title || ''}
          readOnly={publishedReadOnly}
          onChange={e => {
            updatePublication({ title: e.target.value })
            if (e.target.value.trim()) setTitleError(false)
          }}
          placeholder="Title"
          style={{
            width: '100%', background: 'transparent',
            border: 'none', borderBottom: titleError ? '2px solid #ef4444' : '2px solid transparent',
            outline: 'none', color: titleError ? '#ef4444' : TEXT,
            fontSize: 28, fontWeight: 800,
            padding: '0 0 4px', fontFamily: 'system-ui,-apple-system,sans-serif',
            boxSizing: 'border-box', marginBottom: titleError ? 4 : 8,
            transition: 'border-color 0.2s, color 0.2s',
          }}
        />
        {titleError && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>
            Title is required before publishing
          </div>
        )}

        <input
          value={publication.subtitle || ''}
          readOnly={publishedReadOnly}
          onChange={e => updatePublication({ subtitle: e.target.value })}
          placeholder="Subtitle (optional)"
          style={{
            width: '100%', background: 'transparent', border: 'none',
            outline: 'none', color: MUTED, fontSize: 16,
            padding: 0, fontFamily: 'system-ui,-apple-system,sans-serif',
            boxSizing: 'border-box', marginBottom: 20,
          }}
        />

        <div style={{ borderTop: '1px solid ' + BORDER, marginBottom: 20 }} />

        {/* Chapter header */}
        {activeChapter && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: meta.accent, letterSpacing: '0.12em', marginBottom: 8 }}>
              {meta.chapterLabel.toUpperCase()} {activeChapter.number}
            </div>
            <input
              value={activeChapter.title || ''}
              readOnly={publishedReadOnly}
              onChange={e => updateChapterTitle(activeChapter.id, e.target.value)}
              placeholder={`${meta.chapterLabel} title`}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                outline: 'none', color: TEXT, fontSize: 20, fontWeight: 700,
                padding: 0, fontFamily: 'system-ui,-apple-system,sans-serif',
                boxSizing: 'border-box', marginBottom: 8,
              }}
            />
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 16 }}>
              {activeChapter.word_count.toLocaleString()} words · {activeChapter.reading_time_min} min read
            </div>
            {!publishedReadOnly && (
              <button
                onClick={() => setOutcomesOpen(true)}
                style={{
                  background: SURF, border: '1px solid ' + BORDER,
                  borderRadius: 8, padding: '6px 12px', marginBottom: 16,
                  color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                🎯 Curriculum Outcomes
              </button>
            )}
            <div style={{ borderTop: '1px solid ' + BORDER, marginBottom: 16 }} />
          </>
        )}

        {/* Blocks */}
        {activeChapter && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeChapter.blocks.length === 0 ? (
              <div onClick={() => { if (!publishedReadOnly) addBlock('paragraph') }} style={{
                border: '2px dashed ' + BORDER, borderRadius: 12,
                padding: '36px 16px', textAlign: 'center',
                cursor: publishedReadOnly ? 'default' : 'pointer', color: MUTED, fontSize: 14,
              }}>
                {publishedReadOnly ? 'No content in this chapter.' : 'Tap to start writing…'}
              </div>
            ) : (
              activeChapter.blocks.map(block => (
                <ContentBlockEditor
                  key={block.id}
                  block={block}
                  format={format}
                  readOnly={publishedReadOnly}
                  isFocused={focusedBlockId === block.id}
                  onFocus={() => setFocusedBlockId(block.id)}
                  onUpdate={updated => updateBlock(updated.id, updated.content, updated.meta)}
                  onDelete={() => deleteBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, 'up')}
                  onMoveDown={() => moveBlock(block.id, 'down')}
                />
              ))
            )}
          </div>
        )}
      </main>

      {!publishedReadOnly && (
        <BlockToolbar
          format={format}
          onAddBlock={type => addBlock(type, focusedBlockId ?? undefined)}
        />
      )}

      <ChapterSidebar
        format={format}
        chapters={chapters}
        activeChapterId={activeChapterId}
        onSelectChapter={setActiveChapterId}
        onAddChapter={publishedReadOnly ? () => undefined : addChapter}
        onDeleteChapter={publishedReadOnly ? () => undefined : deleteChapter}
        onTitleChange={publishedReadOnly ? () => undefined : updateChapterTitle}
        onStatusChange={publishedReadOnly ? () => undefined : updateChapterStatus}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {!publishedReadOnly && (
        <PublicationSetupDrawer
          publication={publication}
          isOpen={setupOpen}
          onClose={() => setSetupOpen(false)}
          onUpdate={updatePublication}
          onPublish={async () => { const ok = await publishPublication(); return ok }}
        />
      )}

      {activeChapter && !publishedReadOnly && (
        <OutcomeSelector
          isOpen={outcomesOpen}
          onClose={() => setOutcomesOpen(false)}
          publicationId={publication.id}
          chapterId={activeChapter.id}
          chapterLabel={`${meta.chapterLabel} ${activeChapter.number}: ${activeChapter.title || 'Untitled'}`}
          curriculumId={activeChapter.curriculum_id}
          subStrandId={activeChapter.sub_strand_id}
          ensureChapterSaved={forceSave}
        />
      )}
    </div>
  )
}
