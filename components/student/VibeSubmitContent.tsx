'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const BG      = '#090D16'
const SURFACE = '#111827'
const CARD    = '#1a2235'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const TEXT    = '#ffffff'
const GREEN   = '#10b981'
const RED     = '#ff4d4d'

type ContentType = 'ebook' | 'epage'

interface SubmitForm {
  title: string
  description: string
  url: string
  type: ContentType
  source: string
  tags: string
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function VibeSubmitContent({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SubmitForm>({
    title: '',
    description: '',
    url: '',
    type: 'epage',
    source: '',
    tags: '',
  })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const set = useCallback((key: keyof SubmitForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'url') setUrlError(null)
  }, [])

  const validateUrl = useCallback(() => {
    if (!form.url.trim()) {
      setUrlError('URL is required')
      return false
    }
    if (!isValidUrl(form.url)) {
      setUrlError('Enter a valid URL starting with http:// or https://')
      return false
    }
    setUrlError(null)
    return true
  }, [form.url])

  const handleSubmit = useCallback(async () => {
    setError(null)
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!validateUrl()) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be signed in to submit content')

      const tagsArray = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const { error: err } = await supabase
        .from('vibelearn_content')
        .insert({
          title:        form.title.trim(),
          description:  form.description.trim() || null,
          url:          form.url.trim(),
          type:         form.type,
          source:       form.source.trim() || null,
          tags:         tagsArray,
          submitted_by: user.id,
          view_count:   0,
        })

      if (err) throw err
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }, [form, validateUrl])

  if (success) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 12 }}>
          Content Submitted!
        </div>
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 32 }}>
          Your content is now live on VibeLearn. Anyone on the platform can find and learn from it.
        </div>
        <button
          onClick={() => {
            setSuccess(false)
            setForm({ title: '', description: '', url: '', type: 'epage', source: '', tags: '' })
          }}
          style={{
            background: 'rgba(204,255,0,0.1)',
            border: '1px solid rgba(204,255,0,0.3)',
            borderRadius: 12, padding: '12px 28px',
            color: ACCENT, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', marginBottom: 12,
          }}
        >
          Submit Another
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: MUTED, fontSize: 13, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{
        fontSize: 11, color: MUTED, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20,
      }}>
        📤 Submit Content
      </div>

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['epage', 'ebook'] as const).map(t => (
          <button
            key={t}
            onClick={() => set('type', t)}
            disabled={loading}
            aria-label={`Select type ${t}`}
            style={{
              flex: 1,
              background: form.type === t ? ACCENT : 'rgba(255,255,255,0.05)',
              color: form.type === t ? '#000' : MUTED,
              border: 'none', borderRadius: 10,
              padding: '10px 0', fontSize: 12,
              fontWeight: 800, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}
          >
            {t === 'ebook' ? '📖 Ebook' : '📄 Epage'}
          </button>
        ))}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6, letterSpacing: 0.6 }}>
          TITLE *
        </div>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Form 2 Chemistry Notes"
          disabled={loading}
          aria-label="Content title"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '13px 16px',
            fontSize: 13, color: TEXT, outline: 'none',
          }}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6, letterSpacing: 0.6 }}>
          DESCRIPTION
        </div>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="What will students learn from this?"
          disabled={loading}
          aria-label="Content description"
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '13px 16px',
            fontSize: 13, color: TEXT, outline: 'none',
            resize: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* URL */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6, letterSpacing: 0.6 }}>
          URL *
        </div>
        <input
          value={form.url}
          onChange={e => set('url', e.target.value)}
          onBlur={validateUrl}
          placeholder="https://"
          disabled={loading}
          aria-label="Content URL"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD,
            border: `1px solid ${urlError ? RED : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12, padding: '13px 16px',
            fontSize: 13, color: TEXT, outline: 'none',
          }}
        />
        {urlError && (
          <div style={{ fontSize: 11, color: RED, marginTop: 5 }}>{urlError}</div>
        )}
      </div>

      {/* Source */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6, letterSpacing: 0.6 }}>
          SOURCE
        </div>
        <input
          value={form.source}
          onChange={e => set('source', e.target.value)}
          placeholder="e.g. KLB, Elimu Library, Khan Academy"
          disabled={loading}
          aria-label="Content source"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '13px 16px',
            fontSize: 13, color: TEXT, outline: 'none',
          }}
        />
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6, letterSpacing: 0.6 }}>
          TAGS
        </div>
        <input
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
          placeholder="chemistry, form2, kcse — comma separated"
          disabled={loading}
          aria-label="Content tags"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '13px 16px',
            fontSize: 13, color: TEXT, outline: 'none',
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(255,77,77,0.1)',
          border: '1px solid rgba(255,77,77,0.3)',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 12, color: RED, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        aria-label="Submit content to VibeLearn"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: loading ? 'rgba(204,255,0,0.4)' : ACCENT,
          border: 'none', borderRadius: 14,
          padding: '16px 0', fontSize: 14,
          fontWeight: 800, color: '#000',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Submitting...' : 'Submit to VibeLearn →'}
      </button>

      <button
        onClick={onClose}
        disabled={loading}
        aria-label="Cancel submission"
        style={{
          width: '100%', marginTop: 12,
          background: 'none', border: 'none',
          color: MUTED, fontSize: 13,
          cursor: 'pointer', padding: '10px 0',
        }}
      >
        Cancel
      </button>
    </div>
  )
}
