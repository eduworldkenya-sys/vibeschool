"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { createBrowserClient } from '@supabase/ssr'
import { ContentBlock } from '@/lib/publishTypes'

const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.48)'
const ACCENT = '#CCFF00'
const SURF = '#111827'
const CARD = '#1a2235'
const BORDER = 'rgba(255,255,255,0.08)'

type AnySpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type WindowWithSpeech = Window & {
  webkitSpeechRecognition?: new () => AnySpeechRecognition
  SpeechRecognition?: new () => AnySpeechRecognition
}

interface Props {
  block: ContentBlock
  format: string
  readOnly?: boolean
  isFocused: boolean
  onUpdate: (updated: ContentBlock) => void
  onFocus: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function multilineBlock(
  label: string,
  icon: string,
  block: ContentBlock,
  readOnly: boolean,
  onUpdate: (updated: ContentBlock) => void,
  placeholder: string,
  accent = ACCENT,
) {
  return (
    <div style={{ background: `${accent}0D`, border: `1px solid ${accent}33`, borderRadius: 12, padding: 14 }}>
      <div style={{ color: accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>
        {icon} {label.toUpperCase()}
      </div>
      {readOnly ? (
        <div style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{block.content}</div>
      ) : (
        <textarea
          value={block.content}
          rows={4}
          placeholder={placeholder}
          onChange={e => onUpdate({ ...block, content: e.target.value })}
          style={{ width: '100%', background: 'transparent', color: TEXT, border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.65, fontSize: 14, boxSizing: 'border-box' }}
        />
      )}
    </div>
  )
}

function metaString(block: ContentBlock, key: string): string {
  const value = block.meta?.[key]
  return typeof value === 'string' ? value : ''
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url)
}

function isDirectAudio(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|webm)(?:$|[?#])/i.test(url)
}

function mediaCaption(block: ContentBlock) {
  const caption = metaString(block, 'caption')
  return caption ? <div style={{ color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{caption}</div> : null
}

function ReadOnlyMedia({ block, label }: { block: ContentBlock; label: 'Video' | 'Audio' | '3D model' | 'Simulation' }) {
  const safeUrl = safeHttpUrl(block.content)
  const [modelActive, setModelActive] = useState(false)

  if (!safeUrl) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <div style={{ color: MUTED, fontSize: 12 }}>{label} unavailable.</div>
        {mediaCaption(block)}
      </div>
    )
  }

  if (label === 'Video' && isDirectVideo(safeUrl)) {
    return (
      <figure style={{ margin: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <video controls playsInline preload="metadata" src={safeUrl} style={{ display: 'block', width: '100%', maxHeight: '70dvh', background: '#000' }} />
        <figcaption style={{ padding: metaString(block, 'caption') ? '0 12px 11px' : 0 }}>{mediaCaption(block)}</figcaption>
      </figure>
    )
  }

  if (label === 'Audio' && isDirectAudio(safeUrl)) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <audio controls preload="metadata" src={safeUrl} style={{ width: '100%' }} />
        {mediaCaption(block)}
      </div>
    )
  }

  if (label === '3D model') {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ color: ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }}>3D MODEL</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 5 }}>Loaded only when requested to keep the book fast on mobile.</div>
          </div>
          <button
            type="button"
            onClick={() => setModelActive(true)}
            style={{ border: 'none', borderRadius: 10, padding: '9px 12px', background: ACCENT, color: '#090D16', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
          >
            Explore
          </button>
        </div>
        {modelActive && (
          <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${BORDER}`, padding: 14, background: SURF }}>
            <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.55 }}>Interactive 3D viewer support is reserved for validated GLB/GLTF assets. Until the dedicated renderer is installed, open the model in its trusted source.</div>
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: ACCENT, marginTop: 10, fontSize: 13, fontWeight: 700 }}>Open 3D model ↗</a>
          </div>
        )}
        {mediaCaption(block)}
      </div>
    )
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>{label.toUpperCase()}</div>
      <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>Open {label} ↗</a>
      {label === 'Simulation' && <div style={{ color: MUTED, fontSize: 11, marginTop: 7 }}>External simulations open separately; arbitrary third-party scripts are not embedded inside textbook pages.</div>}
      {mediaCaption(block)}
    </div>
  )
}

export function ContentBlockEditor({
  block, readOnly = false, isFocused,
  onUpdate, onFocus, onDelete, onMoveUp, onMoveDown,
}: Props) {
  const [isListening, setIsListening] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<AnySpeechRecognition | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Write here…' }), Typography],
    content: block.type === 'paragraph' ? block.content : '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        style: 'outline:none;color:#fff;font-size:16px;line-height:1.8;min-height:56px;font-family:system-ui,-apple-system,sans-serif;padding-right:40px',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (block.type === 'paragraph') onUpdate({ ...block, content: ed.getHTML() })
    },
  })

  const getSR = (): (new () => AnySpeechRecognition) | undefined => {
    const w = window as WindowWithSpeech
    return w.webkitSpeechRecognition ?? w.SpeechRecognition
  }

  const startSpeech = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = getSR()
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-KE'
    rec.onresult = e => {
      const transcript = e.results[0][0].transcript
      if (editor) editor.commands.insertContent(' ' + transcript)
      setIsListening(false)
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [editor])

  const stopSpeech = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const ext = rawExt ? rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return
    setUploading(true)
    try {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Sign in before uploading publication media.')
      const path = `${user.id}/pub_blocks/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('vibe-publication-images').upload(path, file)
      if (error) throw error
      const { data } = sb.storage.from('vibe-publication-images').getPublicUrl(path)
      onUpdate({ ...block, content: data.publicUrl })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const base: React.CSSProperties = {
    width: '100%', background: 'transparent', border: 'none', color: TEXT,
    outline: 'none', fontFamily: 'system-ui,-apple-system,sans-serif',
    fontSize: 16, lineHeight: 1.8, resize: 'none', padding: 0, boxSizing: 'border-box',
  }

  const mediaUrlEditor = (label: string, hint: string) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>{label.toUpperCase()}</div>
      <>
        <input value={block.content} onChange={e => onUpdate({ ...block, content: e.target.value })} placeholder={hint} style={{ ...base, background: SURF, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 12px', fontSize: 13 }} />
        <input value={metaString(block, 'caption')} onChange={e => onUpdate({ ...block, meta: { ...block.meta, caption: e.target.value } })} placeholder="Caption / learning purpose" style={{ ...base, marginTop: 8, fontSize: 12, color: MUTED }} />
      </>
    </div>
  )

  const renderBlock = () => {
    switch (block.type) {
      case 'paragraph':
        return (
          <div style={{ position: 'relative' }}>
            {readOnly ? <div style={{ ...base, minHeight: 24 }} dangerouslySetInnerHTML={{ __html: block.content }} /> : <EditorContent editor={editor} />}
            {!readOnly && isFocused && typeof window !== 'undefined' && !!getSR() && (
              <button onClick={isListening ? stopSpeech : startSpeech} aria-label={isListening ? 'Stop dictation' : 'Start dictation'} style={{ position: 'absolute', right: 0, top: 4, width: 30, height: 30, borderRadius: '50%', border: `1px solid ${BORDER}`, background: isListening ? 'rgba(239,68,68,.15)' : SURF, cursor: 'pointer' }}>🎤</button>
            )}
          </div>
        )
      case 'heading1':
      case 'heading2':
      case 'heading3': {
        const size = block.type === 'heading1' ? 28 : block.type === 'heading2' ? 22 : 18
        return readOnly ? <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.3 }}>{block.content}</div> : <input style={{ ...base, fontSize: size, fontWeight: 800 }} value={block.content} placeholder="Heading" onChange={e => onUpdate({ ...block, content: e.target.value })} />
      }
      case 'quote': return multilineBlock('Quote', '“', block, readOnly, onUpdate, 'Quotation…', '#A78BFA')
      case 'definition': return multilineBlock('Definition', 'D', block, readOnly, onUpdate, 'Define the concept clearly…', '#60A5FA')
      case 'example': return multilineBlock('Example', 'Ex', block, readOnly, onUpdate, 'Give a concrete example…', '#34D399')
      case 'workedExample': return multilineBlock('Worked example', '✓', block, readOnly, onUpdate, 'Show the reasoning or steps…', '#34D399')
      case 'summary': return multilineBlock('Summary', 'Σ', block, readOnly, onUpdate, 'Summarise this section…', '#FBBF24')
      case 'keyPoints': return multilineBlock('Key points', '★', block, readOnly, onUpdate, 'One key point per line…', '#FBBF24')
      case 'activity': return multilineBlock('Activity', '📋', block, readOnly, onUpdate, 'Describe the learning activity…')
      case 'experiment': return multilineBlock('Experiment', '⚗', block, readOnly, onUpdate, 'Aim, materials, procedure, observations and safety…', '#F59E0B')
      case 'project': return multilineBlock('Project', '🛠', block, readOnly, onUpdate, 'Describe the project, output and success criteria…', '#F59E0B')
      case 'question': return multilineBlock('Question', '❓', block, readOnly, onUpdate, 'Write the question…', '#45B7D1')
      case 'callout': return multilineBlock('Note', '💡', block, readOnly, onUpdate, 'Important note…')
      case 'bulletList':
      case 'numberedList': {
        const items = block.content.split('\n').filter(Boolean)
        if (readOnly) {
          const Tag = block.type === 'bulletList' ? 'ul' : 'ol'
          return <Tag style={{ margin: 0, paddingLeft: 22 }}>{items.map((item, i) => <li key={i} style={{ marginBottom: 5, lineHeight: 1.6 }}>{item}</li>)}</Tag>
        }
        return <textarea style={{ ...base, minHeight: 70 }} value={block.content} placeholder="One item per line" onChange={e => onUpdate({ ...block, content: e.target.value })} />
      }
      case 'image':
      case 'diagram':
        return (
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            {block.content ? <img loading="lazy" decoding="async" src={block.content} alt={metaString(block, 'alt') || metaString(block, 'caption') || (block.type === 'diagram' ? 'Diagram' : 'Illustration')} style={{ display: 'block', width: '100%', maxHeight: 460, objectFit: 'contain', background: '#0b1020' }} /> : !readOnly ? <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: 34, background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer' }}>{uploading ? 'Uploading…' : block.type === 'diagram' ? 'Upload diagram / illustration' : 'Upload image / illustration'}</button> : null}
            {!readOnly && (
              <div style={{ padding: 12 }}>
                <button onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: SURF, color: TEXT, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>{block.content ? 'Replace media' : 'Choose media'}</button>
                <input ref={fileRef} type="file" accept="image/*,.svg" hidden onChange={handleImageUpload} />
                <input value={metaString(block, 'caption')} onChange={e => onUpdate({ ...block, meta: { ...block.meta, caption: e.target.value } })} placeholder="Caption" style={{ ...base, marginTop: 10, fontSize: 12 }} />
                <input value={metaString(block, 'alt')} onChange={e => onUpdate({ ...block, meta: { ...block.meta, alt: e.target.value } })} placeholder="Alt text / what learners should notice" style={{ ...base, marginTop: 6, fontSize: 12, color: MUTED }} />
              </div>
            )}
            {readOnly && metaString(block, 'caption') && <div style={{ padding: '9px 12px', color: MUTED, fontSize: 12 }}>{metaString(block, 'caption')}</div>}
          </div>
        )
      case 'video': return readOnly ? <ReadOnlyMedia block={block} label="Video" /> : mediaUrlEditor('Video', 'https://… direct MP4/WebM video URL')
      case 'audio': return readOnly ? <ReadOnlyMedia block={block} label="Audio" /> : mediaUrlEditor('Audio', 'https://… direct MP3/M4A/OGG audio URL')
      case 'model3d': return readOnly ? <ReadOnlyMedia block={block} label="3D model" /> : mediaUrlEditor('3D model', 'https://… .glb/.gltf model URL')
      case 'simulation': return readOnly ? <ReadOnlyMedia block={block} label="Simulation" /> : mediaUrlEditor('Simulation', 'https://… trusted simulation URL')
      case 'equation': return multilineBlock('Equation', '∑', block, readOnly, onUpdate, 'Enter equation or mathematical expression…', '#C084FC')
      case 'table': {
        const rows = block.content.split('\n').filter(Boolean).map(row => row.split('|').map(cell => cell.trim()))
        if (readOnly) return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ border: `1px solid ${BORDER}`, padding: 8 }}>{cell}</td>)}</tr>)}</tbody></table></div>
        return <textarea style={{ ...base, minHeight: 90, fontFamily: 'monospace' }} value={block.content} placeholder={'Cell 1 | Cell 2\nValue 1 | Value 2'} onChange={e => onUpdate({ ...block, content: e.target.value })} />
      }
      case 'divider': return <hr style={{ border: 0, borderTop: `1px solid ${BORDER}`, margin: '12px 0' }} />
      case 'code': return readOnly ? <pre style={{ background: SURF, borderRadius: 10, padding: 12, overflowX: 'auto' }}><code>{block.content}</code></pre> : <textarea style={{ ...base, minHeight: 90, fontFamily: 'monospace', background: SURF, borderRadius: 10, padding: 12 }} value={block.content} placeholder="Code…" onChange={e => onUpdate({ ...block, content: e.target.value })} />
      default: return null
    }
  }

  return (
    <div onFocus={onFocus} style={{ position: 'relative', borderRadius: 12, padding: '9px 10px', border: `1px solid ${isFocused ? 'rgba(204,255,0,.28)' : BORDER}`, background: isFocused ? 'rgba(204,255,0,.02)' : 'transparent', marginBottom: 4 }}>
      {!readOnly && isFocused && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, zIndex: 10 }}>
          <button aria-label="Move block up" onClick={onMoveUp} style={{ background: SURF, border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>↑</button>
          <button aria-label="Move block down" onClick={onMoveDown} style={{ background: SURF, border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>↓</button>
          <button aria-label="Delete block" onClick={onDelete} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: '#ff7b7b', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {renderBlock()}
    </div>
  )
}
