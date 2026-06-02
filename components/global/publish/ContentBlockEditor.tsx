'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { createBrowserClient } from '@supabase/ssr'
import { ContentBlock } from '@/lib/publishTypes'

const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const ACCENT = '#CCFF00'
const SURF   = '#111827'
const BORDER = 'rgba(255,255,255,0.06)'

interface Props {
  block:    ContentBlock
  format:   string
  readOnly?: boolean
  onUpdate: (updated: ContentBlock) => void
  onFocus:  () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ContentBlockEditor({
  block, format, readOnly = false,
  onUpdate, onFocus, onDelete, onMoveUp, onMoveDown,
}: Props) {
  const [isFocused,   setIsFocused]   = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const fileRef        = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isInitialMount = useRef(true)

  // ── Tiptap for paragraph only ────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write here…' }),
      Typography,
    ],
    content:  block.type === 'paragraph' ? block.content : '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        style: [
          'outline:none',
          'color:#ffffff',
          'font-size:16px',
          'line-height:1.8',
          'min-height:56px',
          'font-family:system-ui,-apple-system,sans-serif',
          'padding-right:40px',
        ].join(';'),
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (block.type !== 'paragraph') return
      onUpdate({ ...block, content: ed.getHTML() })
    },
  })

  // Sync external content changes into Tiptap WITHOUT resetting cursor.
  // Only runs when content changes from outside (e.g. load from DB),
  // not on every keystroke — guarded by isInitialMount ref.
  useEffect(() => {
    if (!editor || block.type !== 'paragraph') return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const current = editor.getHTML()
    if (current !== block.content) {
      editor.commands.setContent(block.content, false, { preserveWhitespace: 'full' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally empty — only runs on mount

  // ── Web Speech API — instance per component, not module-level ────────────
  const startSpeech = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!('webkitSpeechRecognition' in window)) return
    const SpeechRecognition = (window as Window & { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.continuous      = false
    rec.interimResults  = false
    rec.lang            = 'en-KE'
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      if (editor) editor.commands.insertContent(' ' + transcript)
      setIsListening(false)
    }
    rec.onend  = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [editor])

  const stopSpeech = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const ext    = rawExt ? rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return
    setUploading(true)
    try {
      const sb   = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const path = `pub_blocks/${crypto.randomUUID()}.${ext}`
      const { error: ue } = await sb.storage
        .from('vibe-publication-images')
        .upload(path, file)
      if (ue) return
      const { data } = sb.storage
        .from('vibe-publication-images')
        .getPublicUrl(path)
      onUpdate({ ...block, content: data.publicUrl })
    } finally {
      setUploading(false)
    }
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const base: React.CSSProperties = {
    width:       '100%',
    background:  'transparent',
    border:      'none',
    color:       TEXT,
    outline:     'none',
    fontFamily:  'system-ui,-apple-system,sans-serif',
    fontSize:    '16px',
    lineHeight:  '1.8',
    resize:      'none',
    padding:     0,
    boxSizing:   'border-box',
  }

  // ── Block renderer ────────────────────────────────────────────────────────
  const renderBlock = () => {
    switch (block.type) {

      case 'paragraph':
        return (
          <div style={{ position: 'relative' }}>
            {readOnly
              ? <div
                  style={{ ...base, minHeight: 24 }}
                  dangerouslySetInnerHTML={{ __html: block.content }}
                />
              : <EditorContent editor={editor} />
            }
            {!readOnly && isFocused && typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && (
              <button
                onClick={isListening ? stopSpeech : startSpeech}
                style={{
                  position:    'absolute',
                  right:       0,
                  top:         4,
                  background:  isListening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                  border:      isListening ? '1px solid rgba(239,68,68,0.6)' : '1px solid ' + BORDER,
                  borderRadius: '50%',
                  width:       30,
                  height:      30,
                  display:     'flex',
                  alignItems:  'center',
                  justifyContent: 'center',
                  cursor:      'pointer',
                  fontSize:    14,
                  animation:   isListening ? 'micPulse 1.5s infinite' : 'none',
                }}
              >
                🎤
              </button>
            )}
          </div>
        )

      case 'heading1':
        return readOnly
          ? <h1 style={{ fontSize: 28, fontWeight: 800, color: TEXT, margin: 0, lineHeight: 1.3 }}>{block.content}</h1>
          : <input style={{ ...base, fontSize: 26, fontWeight: 800 }} value={block.content}
              placeholder="Heading 1" onChange={e => onUpdate({ ...block, content: e.target.value })} />

      case 'heading2':
        return readOnly
          ? <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>{block.content}</h2>
          : <input style={{ ...base, fontSize: 20, fontWeight: 700 }} value={block.content}
              placeholder="Heading 2" onChange={e => onUpdate({ ...block, content: e.target.value })} />

      case 'heading3':
        return readOnly
          ? <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: 0 }}>{block.content}</h3>
          : <input style={{ ...base, fontSize: 17, fontWeight: 700 }} value={block.content}
              placeholder="Heading 3" onChange={e => onUpdate({ ...block, content: e.target.value })} />

      case 'quote':
        return (
          <div style={{ borderLeft: '3px solid ' + ACCENT, paddingLeft: 14 }}>
            {readOnly
              ? <p style={{ ...base, fontStyle: 'italic', color: MUTED, margin: 0 }}>{block.content}</p>
              : <textarea style={{ ...base, fontStyle: 'italic', color: MUTED, minHeight: 48 }}
                  value={block.content} placeholder="Quote…" rows={2}
                  onChange={e => onUpdate({ ...block, content: e.target.value })} />
            }
          </div>
        )

      case 'bulletList':
        return readOnly
          ? <ul style={{ paddingLeft: 20, margin: 0 }}>
              {block.content.split('\n').filter(Boolean).map((l, i) =>
                <li key={i} style={{ fontSize: 15, lineHeight: 1.8, color: TEXT }}>{l}</li>
              )}
            </ul>
          : <textarea style={{ ...base, fontSize: 15, minHeight: 56 }}
              value={block.content} placeholder="One item per line" rows={3}
              onChange={e => onUpdate({ ...block, content: e.target.value })} />

      case 'numberedList':
        return readOnly
          ? <ol style={{ paddingLeft: 20, margin: 0 }}>
              {block.content.split('\n').filter(Boolean).map((l, i) =>
                <li key={i} style={{ fontSize: 15, lineHeight: 1.8, color: TEXT }}>{l}</li>
              )}
            </ol>
          : <textarea style={{ ...base, fontSize: 15, minHeight: 56 }}
              value={block.content} placeholder="One item per line" rows={3}
              onChange={e => onUpdate({ ...block, content: e.target.value })} />

      case 'image':
        return (
          <div>
            {block.content
              ? <img src={block.content} alt="Block image"
                  style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover' }} />
              : !readOnly
              ? <div onClick={() => fileRef.current?.click()} style={{
                  border: '2px dashed ' + BORDER, borderRadius: 10,
                  padding: '28px 16px', textAlign: 'center',
                  cursor: 'pointer', color: MUTED, fontSize: 13,
                }}>
                  {uploading ? 'Uploading…' : '📷 Tap to upload image'}
                  <input ref={fileRef} type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handleImageUpload} />
                </div>
              : null
            }
          </div>
        )

      case 'divider':
        return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />

      case 'callout':
        return (
          <div style={{
            background: SURF, borderLeft: '3px solid ' + ACCENT,
            borderRadius: 10, padding: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18 }}>💡</span>
            {readOnly
              ? <p style={{ fontSize: 14, color: TEXT, margin: 0, lineHeight: 1.6 }}>{block.content}</p>
              : <textarea style={{ ...base, fontSize: 14, minHeight: 40 }}
                  value={block.content} placeholder="Callout text…" rows={2}
                  onChange={e => onUpdate({ ...block, content: e.target.value })} />
            }
          </div>
        )

      case 'code':
        return (
          <div style={{ background: SURF, borderRadius: 10, border: '1px solid ' + BORDER, overflow: 'hidden' }}>
            <div style={{ padding: '3px 12px', borderBottom: '1px solid ' + BORDER }}>
              <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>code</span>
            </div>
            {readOnly
              ? <pre style={{ margin: 0, padding: '10px 12px', fontSize: 13, color: TEXT, fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  <code>{block.content}</code>
                </pre>
              : <textarea style={{ ...base, fontSize: 13, fontFamily: 'monospace', padding: '10px 12px', minHeight: 80, display: 'block' }}
                  value={block.content} placeholder="// code here…" rows={4}
                  onChange={e => onUpdate({ ...block, content: e.target.value })} />
            }
          </div>
        )

      case 'activity':
        return (
          <div style={{ background: 'rgba(204,255,0,0.05)', border: '1px solid rgba(204,255,0,0.15)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', marginBottom: 8 }}>📋 ACTIVITY</div>
            {readOnly
              ? <p style={{ fontSize: 14, color: TEXT, margin: 0, lineHeight: 1.6 }}>{block.content}</p>
              : <textarea style={{ ...base, fontSize: 14, minHeight: 60 }}
                  value={block.content} placeholder="Describe the activity…" rows={3}
                  onChange={e => onUpdate({ ...block, content: e.target.value })} />
            }
          </div>
        )

      case 'question':
        return (
          <div style={{ background: 'rgba(69,183,209,0.05)', border: '1px solid rgba(69,183,209,0.2)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#45B7D1', letterSpacing: '0.1em', marginBottom: 8 }}>❓ QUESTION</div>
            {readOnly
              ? <p style={{ fontSize: 14, color: TEXT, margin: 0 }}>{block.content}</p>
              : <textarea style={{ ...base, fontSize: 14, minHeight: 40 }}
                  value={block.content} placeholder="Write the question…" rows={2}
                  onChange={e => onUpdate({ ...block, content: e.target.value })} />
            }
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}' }} />
      <div
        onFocus={() => { setIsFocused(true); onFocus() }}
        onBlur={() => setIsFocused(false)}
        style={{
          position:   'relative',
          borderRadius: 10,
          padding:    '8px 10px',
          border:     '1px solid ' + (isFocused ? 'rgba(204,255,0,0.2)' : BORDER),
          background: isFocused ? 'rgba(204,255,0,0.02)' : 'transparent',
          transition: 'border-color 0.15s',
          marginBottom: 4,
        }}
      >
        {!readOnly && isFocused && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', gap: 4, zIndex: 10,
          }}>
            <button onClick={onMoveUp} style={{
              background: SURF, border: '1px solid ' + BORDER,
              color: MUTED, borderRadius: 5,
              padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            }}>↑</button>
            <button onClick={onMoveDown} style={{
              background: SURF, border: '1px solid ' + BORDER,
              color: MUTED, borderRadius: 5,
              padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            }}>↓</button>
            <button onClick={onDelete} style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', borderRadius: 5,
              padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            }}>✕</button>
          </div>
        )}
        <div style={{ paddingRight: isFocused && !readOnly ? 76 : 0 }}>
          {renderBlock()}
        </div>
      </div>
    </>
  )
}
