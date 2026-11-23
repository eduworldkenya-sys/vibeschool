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

const BG     = 'var(--publication-canvas, #090D16)'
const SURF   = 'var(--publication-surface, #111827)'
const ACCENT = 'var(--publication-accent, #CCFF00)'
const TEXT   = 'var(--publication-text, #ffffff)'
const MUTED  = 'var(--publication-muted, rgba(255,255,255,0.4))'
const BORDER = 'var(--publication-border, rgba(255,255,255,0.06))'

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
  simpleMode?: boolean
  publishingEnabled?: boolean
}

export function PublicationEditor({ authorId, format, publicationId, simpleMode = false, publishingEnabled = false }: Props) {
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
  const [checksOpen, setChecksOpen] = useState(false)
  const [materialsConfirmed, setMaterialsConfirmed] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const [blockerHelp, setBlockerHelp] = useState<string | null>(null)
  const [jumpBlockId, setJumpBlockId] = useState<string | null>(null)
  const [insertTarget, setInsertTarget] = useState<'paragraph' | 'image' | 'question' | null>(null)

  // Quick setup modal state
  const [quickSetup,     setQuickSetup]     = useState(false)
  const [quickTitle,     setQuickTitle]     = useState('')
  const [quickGenre,     setQuickGenre]     = useState<PublicationGenre>('other')
  const [quickTitleErr,  setQuickTitleErr]  = useState(false)

  const firstBlockFocused = useRef(false)
  const titleInputRef     = useRef<HTMLInputElement>(null)

  // Auto-open quick setup on first load for new publications
  useEffect(() => {
    if (!simpleMode && !loading && publication && !publicationId && !publication.title) {
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

  const canPublish = !simpleMode || (publishingEnabled && publication?.author_id === authorId)

  const saveLabel = saving
    ? 'Saving…'
    : lastSaved
    ? 'Saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Draft'

  const handlePublish = async () => {
    // A signed-in Mumbi2 teacher can request release without a second owner activation.
    // The server lifecycle still enforces ownership and independent release checks.
    if (!canPublish) { setBlockerHelp('Sign in as Mumbi2 to request publication.'); return }
    if (simpleMode && !materialsConfirmed) {
      setChecksOpen(true)
      setBlockerHelp('Confirm that the existing textbook reading content is ready before publishing.')
      return
    }
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
    const ok = await publishPublication(simpleMode ? { confirmedReadingOnlyTextbook: materialsConfirmed } : undefined)
    setPublishing(false)
    if (ok) router.push('/global/creator/' + authorId)
  }

  const handleQuickSetupDone = () => {
    if (!quickTitle.trim()) { setQuickTitleErr(true); return }
    setQuickTitleErr(false)
    updatePublication({ title: quickTitle.trim(), genre: quickGenre })
    setQuickSetup(false)
  }

  // Count the actual canonical chapter JSON blocks used by this editor. Never
  // mistake a missing server rights/assessment approval for missing draft material.
  const imageCount = chapters.reduce((total, chapter) =>
    total + chapter.blocks.filter(block => block.type === 'image').length, 0)
  const questionCount = chapters.reduce((total, chapter) =>
    total + chapter.blocks.filter(block => block.type === 'question').length, 0)
  const documentChecks = [
    { key: 'title', label: 'Document title', ok: Boolean(publication?.title?.trim()), detail: 'Title required', action: 'Edit title' },
    { key: 'curriculum', label: 'Curriculum fields', ok: format !== 'vibetextbook' || Boolean(publication?.cbc_subject?.trim() && publication?.cbc_grade?.trim()), detail: 'Choose subject and grade in Details', action: 'Open details' },
    { key: 'content', label: 'Written content', ok: chapters.some(chapter => chapter.blocks.some(block => Boolean(block.content?.trim()))), detail: 'Write at least one content block', action: 'Open writing' },
    { key: 'media', label: 'Images (optional)', ok: true, detail: `${imageCount} attached · optional for reading publication`, action: 'Review images' },
    { key: 'assessment', label: 'Questions (optional)', ok: true, detail: `${questionCount} saved · no questions required to publish reading content`, action: 'Review questions' },
    { key: 'authority', label: 'Publishing identity', ok: Boolean(canPublish), detail: canPublish ? 'Mumbi2 authorized · release checks apply' : 'Sign in as Mumbi2', action: 'View access' },
    { key: 'learn', label: 'Learn visibility', ok: false, detail: 'Verified only after publication', action: 'Open preview' },
  ]
  const checkedCount = documentChecks.filter(check => check.ok).length
  // Any material change requires a fresh confirmation; a stale checkbox must not authorize a new draft version.
  useEffect(() => { setMaterialsConfirmed(false) }, [chapters, publication?.title, publication?.cbc_subject, publication?.cbc_grade])
  const draftMaterialsPresent = Boolean(publication?.title?.trim()) && chapters.length > 0
    && chapters.some(chapter => chapter.blocks.some(block => Boolean(block.content?.trim())))
  const optionalMaterialSummary = `${imageCount} images and ${questionCount} questions saved (optional)`

  const activeChapter = chapters.find(c => c.id === activeChapterId) ?? null
  // Navigate only to a real editable element. Deferred focus handles chapter switches.
  useEffect(() => {
    if (!jumpBlockId || !activeChapter?.blocks.some(block => block.id === jumpBlockId)) return
    const element = document.getElementById('studio-block-' + jumpBlockId)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const editable = element.querySelector<HTMLElement>('[contenteditable="true"],textarea,input,button')
    editable?.focus({ preventScroll: true })
    setFocusedBlockId(jumpBlockId)
    setJumpBlockId(null)
  }, [jumpBlockId, activeChapter])

  useEffect(() => {
    if (!insertTarget || previewMode) return
    const element = document.getElementById('studio-insert-' + insertTarget)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.focus()
    setInsertTarget(null)
  }, [insertTarget, previewMode])

  const openBlock = (type: 'paragraph' | 'image' | 'question') => {
    setPreviewMode(false)
    setChecksOpen(false)
    setBlockerHelp(null)
    const chapter = chapters.find(ch => ch.blocks.some(block => block.type === type))
    const target = chapter?.blocks.find(block => block.type === type)
    if (chapter && target) {
      setActiveChapterId(chapter.id)
      setJumpBlockId(target.id)
      return
    }
    if (activeChapter) {
      setActiveChapterId(activeChapter.id)
      // Do not create media/questions automatically; use the existing Insert control.
      setInsertTarget(type)
    } else {
      setSidebarOpen(true)
      setBlockerHelp('Select or add a chapter before inserting content.')
    }
  }
  const openCheck = (key: string, ok: boolean) => {
    if (ok) return
    if (key === 'title') {
      setPreviewMode(false)
      setChecksOpen(false)
      setTitleError(true)
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      titleInputRef.current?.focus()
    } else if (key === 'curriculum') {
      setPreviewMode(false)
      setChecksOpen(false)
      setSetupOpen(true)
    } else if (key === 'content') {
      openBlock('paragraph')
    } else if (key === 'media') {
      openBlock('image')
    } else if (key === 'assessment') {
      openBlock('question')
    } else if (key === 'authority') {
      router.push('/teacher/studio/publishing#publishing-availability')
    } else if (key === 'learn') {
      setChecksOpen(false)
      setPreviewMode(true)
      setBlockerHelp('This is a draft preview. Learn visibility can be verified only by the release service after publication.')
    }
  }
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
        <p style={{ margin: '0 0 18px', color: 'var(--publication-danger, #fca5a5)', fontSize: 13, lineHeight: 1.5 }}>
          {error || 'The textbook could not be loaded.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: ACCENT, color: 'var(--publication-on-accent, #090D16)', border: 'none', borderRadius: 10,
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
      ...(simpleMode ? ({
        '--publication-canvas': '#f6f7fa',
        '--publication-surface': '#ffffff',
        '--publication-text': '#152238',
        '--publication-muted': '#64748b',
        '--publication-accent': '#2563eb',
        '--publication-on-accent': '#ffffff',
        '--publication-border': '#e2e8f0',
        '--publication-accent-border': '#93c5fd',
      } as React.CSSProperties) : {}),
    }}>

      {/* ── Quick Setup Modal ── */}
      {quickSetup && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'var(--publication-scrim, rgba(0,0,0,0.85))', zIndex: 500 }} />
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
                  width: '100%', background: 'var(--publication-surface, #1a2235)',
                  border: '1px solid ' + (quickTitleErr ? 'var(--publication-danger, #ef4444)' : BORDER),
                  borderRadius: 10, padding: '12px 14px',
                  color: TEXT, fontSize: 15, outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: quickTitleErr ? '0 0 0 3px rgba(239,68,68,0.2)' : 'none',
                }}
              />
              {quickTitleErr && (
                <div style={{ fontSize: 12, color: 'var(--publication-danger, #ef4444)', marginTop: 6 }}>Title is required</div>
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
                      background: quickGenre === g.value ? 'var(--publication-surface, rgba(204,255,0,0.1))' : 'var(--publication-surface, #1a2235)',
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
                background: ACCENT, color: 'var(--publication-on-accent, #090D16)',
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
        background: 'var(--publication-surface, rgba(9,13,22,0.95))', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid ' + BORDER,
        padding: '8px 16px', minHeight: 52, boxSizing: 'border-box',
        display: 'flex', flexWrap: simpleMode ? 'wrap' : 'nowrap', gap: 8, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" aria-label="Back" onClick={() => router.back()} style={{
            fontSize: 22, color: TEXT, cursor: 'pointer',
            fontWeight: 300, lineHeight: 1, padding: '4px 8px',
          }}>‹</button>
          <button onClick={() => setSidebarOpen(true)} style={{
            background: SURF, border: '1px solid ' + BORDER,
            borderRadius: 8, padding: '5px 10px',
            color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{meta.icon}</span>
            <span>{simpleMode ? 'Pages' : `${chapters.length} ${meta.chapterPlural}`}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: saving ? ACCENT : MUTED, fontWeight: 600 }}>
            {publishedReadOnly ? 'Published · read only' : saveLabel}
          </span>
          {simpleMode && <>
            <button type="button" onClick={() => setChecksOpen(value => !value)} aria-expanded={checksOpen} style={{ background: SURF, border: '1px solid ' + BORDER, borderRadius: 9, padding: '7px 9px', color: TEXT, cursor: 'pointer', fontSize: 12 }}>
              Checks {checkedCount}/{documentChecks.length}
            </button>
            <button type="button" onClick={() => setPreviewMode(value => !value)} style={{ background: SURF, border: '1px solid ' + BORDER, borderRadius: 9, padding: '7px 9px', color: TEXT, cursor: 'pointer', fontSize: 12 }}>
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          </>}
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
            {publishedReadOnly ? 'Live' : simpleMode ? 'Details' : 'Setup'}
          </button>
          <button onClick={handlePublish} disabled={publishing || publishedReadOnly || !canPublish || (simpleMode && !materialsConfirmed)} title={!canPublish ? 'Sign in as Mumbi2 to request publication' : 'Release checks must pass before publication'} style={{
            background: publishing || publishedReadOnly || !canPublish || (simpleMode && !materialsConfirmed) ? '#e2e8f0' : ACCENT,
            color: !canPublish ? '#475569' : 'var(--publication-on-accent, #090D16)', border: 'none', borderRadius: 10,
            padding: '7px 16px', fontSize: 13, fontWeight: 800,
            cursor: publishing || publishedReadOnly ? 'default' : 'pointer',
          }}>
            {publishedReadOnly ? 'Published' : publishing ? 'Publishing…' : !canPublish ? 'Publish · Locked' : 'Publish'}
          </button>
        </div>
      </header>

      {simpleMode && !publishedReadOnly && <section aria-label="Confirm existing lesson materials" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid ' + BORDER, background: SURF, color: TEXT }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: draftMaterialsPresent ? 'pointer' : 'not-allowed', fontSize: 13 }}>
          <input type="checkbox" checked={materialsConfirmed} disabled={!draftMaterialsPresent} onChange={event => setMaterialsConfirmed(event.target.checked)} aria-label="Confirm existing lesson materials" />
          Book content checked — {optionalMaterialSummary}
        </label>
        <span style={{ fontSize: 12, color: MUTED }}>No questions or Teacher’s Guide required. Publishing releases the textbook reading content only.</span>
      </section>}

      {simpleMode && checksOpen && <section aria-label="Document checks" style={{ background: SURF, borderBottom: '1px solid ' + BORDER, padding: '12px 16px', color: TEXT }}>
        <p style={{ fontSize: 12, margin: '0 0 8px', color: MUTED }}>Questions, images and Teacher’s Guide are optional for publishing textbook reading content. Learner visibility is checked after release.</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {documentChecks.map(check => <li key={check.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <span aria-hidden="true">{check.ok ? '✓' : '○'}</span><strong>{check.label}</strong>
            <span style={{ marginLeft: 'auto', color: MUTED }}>{check.ok ? 'Checked' : check.detail}</span>
            {!check.ok && <button type="button" onClick={() => openCheck(check.key, check.ok)}
              aria-label={check.action + ' for ' + check.label}
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#1d4ed8', padding: '6px 9px', fontWeight: 700, cursor: 'pointer' }}>{check.action} →</button>}
          </li>)}
        </ul>
      </section>}

      {simpleMode && blockerHelp && <div role="status" style={{ padding: '10px 16px', color: TEXT, background: SURF, borderBottom: '1px solid ' + BORDER }}>{blockerHelp}</div>}
      {error && (
        <div style={{
          background: 'var(--publication-danger-soft, rgba(239,68,68,0.1))', border: '1px solid var(--publication-danger-border, rgba(239,68,68,0.2))',
          padding: '10px 16px', fontSize: 13, color: 'var(--publication-danger, #ef4444)',
        }}>{error}</div>
      )}

      {simpleMode && !publishedReadOnly && !previewMode && <nav aria-label="Insert content" style={{ display: 'flex', gap: 8, padding: '10px max(16px, calc((100% - 900px)/2))', alignItems: 'center', flexWrap: 'wrap', background: SURF, borderBottom: '1px solid ' + BORDER }}>
        {([{label:'Text',type:'paragraph'}, {label:'Heading',type:'heading2'}, {label:'Image',type:'image'}, {label:'Table',type:'table'}, {label:'Question',type:'question'}] as const).map(action => <button key={action.type} type="button" id={'studio-insert-' + action.type} onClick={() => addBlock(action.type, focusedBlockId ?? undefined)} style={{ background: '#f8fafc', color: TEXT, border: '1px solid ' + BORDER, borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>+ {action.label}</button>)}
        <button type="button" aria-expanded={moreToolsOpen} onClick={() => setMoreToolsOpen(value => !value)} style={{ background: '#f8fafc', color: TEXT, border: '1px solid ' + BORDER, borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>More {moreToolsOpen ? '−' : '+'}</button>
        {moreToolsOpen && <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {([{label:'Activity',type:'activity'}, {label:'Worked example',type:'workedExample'}, {label:'Bullets',type:'bulletList'}, {label:'Diagram',type:'diagram'}, {label:'Interactive',type:'interactive'}] as const).map(action => <button key={action.type} type="button" onClick={() => {addBlock(action.type, focusedBlockId ?? undefined);setMoreToolsOpen(false)}} style={{ background: SURF, color: TEXT, border: '1px solid ' + BORDER, borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{action.label}</button>)}
        </div>}
      </nav>}
      {simpleMode && previewMode && <p role="status" style={{ textAlign: 'center', color: MUTED, fontSize: 12, margin: '10px 16px 0' }}>Page preview — editing paused. This is not a verified public Learn page.</p>}
      {/* Main */}
      <main style={{
        flex: 1, padding: simpleMode ? '28px 24px' : '16px',
        paddingBottom: simpleMode ? 80 : 160,
        maxWidth: simpleMode ? 900 : 680, margin: simpleMode ? '20px auto' : '0 auto',
        background: simpleMode ? SURF : 'transparent',
        border: simpleMode ? '1px solid ' + BORDER : 'none',
        borderRadius: simpleMode ? 12 : 0,
        boxShadow: simpleMode ? '0 6px 26px rgba(15,23,42,.04)' : 'none',
        width: '100%', boxSizing: 'border-box',
      }}>

        {/* Publication title — with inline error highlight */}
        <input
          ref={titleInputRef}
          value={publication.title || ''}
          readOnly={publishedReadOnly || previewMode}
          onChange={e => {
            updatePublication({ title: e.target.value })
            if (e.target.value.trim()) setTitleError(false)
          }}
          placeholder="Title"
          style={{
            width: '100%', background: 'transparent',
            border: 'none', borderBottom: titleError ? '2px solid var(--publication-danger, #ef4444)' : '2px solid transparent',
            outline: 'none', color: titleError ? 'var(--publication-danger, #ef4444)' : TEXT,
            fontSize: 28, fontWeight: 800,
            padding: '0 0 4px', fontFamily: 'system-ui,-apple-system,sans-serif',
            boxSizing: 'border-box', marginBottom: titleError ? 4 : 8,
            transition: 'border-color 0.2s, color 0.2s',
          }}
        />
        {titleError && (
          <div style={{ fontSize: 12, color: 'var(--publication-danger, #ef4444)', marginBottom: 8 }}>
            Title is required before publishing
          </div>
        )}

        <input
          value={publication.subtitle || ''}
          readOnly={publishedReadOnly || previewMode}
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

        {chapters.length === 0 && <section aria-label="Empty textbook" style={{color:TEXT, textAlign:'center', padding:24}}>
          <h2>Empty textbook</h2><p style={{color:MUTED}}>Connect the curriculum from the textbook library to create its chapters.</p>
          {!publishedReadOnly && <button type="button" onClick={addChapter} style={{background:SURF,color:TEXT,border:'1px solid '+BORDER,borderRadius:8,padding:12}}>Add chapter</button>}
        </section>}
        {/* Chapter header */}
        {activeChapter && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: `var(--publication-accent, ${meta.accent})`, letterSpacing: '0.12em', marginBottom: 8 }}>
              {meta.chapterLabel.toUpperCase()} {activeChapter.number}
            </div>
            <input
              value={activeChapter.title || ''}
              readOnly={publishedReadOnly || previewMode}
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
                <div key={block.id} id={'studio-block-' + block.id} style={{ scrollMarginTop: 120 }}>
                <ContentBlockEditor
                  key={block.id}
                  block={block}
                  format={format}
                  readOnly={publishedReadOnly || previewMode}
                  simpleMode={simpleMode}
                  isFocused={focusedBlockId === block.id}
                  onFocus={() => setFocusedBlockId(block.id)}
                  onUpdate={updated => updateBlock(updated.id, updated.content, updated.meta)}
                  onDelete={() => deleteBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, 'up')}
                  onMoveDown={() => moveBlock(block.id, 'down')}
                />
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {!publishedReadOnly && !simpleMode && !previewMode && (
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
          onPublish={async () => { if (!canPublish || (simpleMode && !materialsConfirmed)) { setChecksOpen(true); return false }; return publishPublication(simpleMode ? { confirmedReadingOnlyTextbook: materialsConfirmed } : undefined) }}
          publishDisabled={!canPublish || (simpleMode && !materialsConfirmed)}
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
