"use client"

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { VibePublication } from '@/lib/publishTypes'

const SURFACE = 'var(--publication-surface)'
const TEXT = 'var(--publication-text)'
const MUTED = 'var(--publication-muted)'
const BORDER = 'var(--publication-border)'
const ACCENT = 'var(--publication-accent)'

type CreateKind = 'lesson' | 'book' | 'resource'

const CREATE_OPTIONS: { kind: CreateKind; label: string; description: string; format: 'vibetextbook' | 'ebook' }[] = [
  { kind: 'lesson', label: 'Lesson', description: 'Curriculum-linked teaching content', format: 'vibetextbook' },
  { kind: 'book', label: 'Book', description: 'A book with chapters', format: 'ebook' },
  { kind: 'resource', label: 'Resource', description: 'Notes and reading materials', format: 'ebook' },
]

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeacherContentStudioPage() {
  const router = useRouter()
  const [publications, setPublications] = useState<VibePublication[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const pendingCreateId = useRef<string | null>(null)
  const [createKind, setCreateKind] = useState<CreateKind>('lesson')
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')
  const visiblePublications = publications.filter(item => filter === 'all' || (filter === 'published' ? item.status === 'published' : item.status !== 'published'))

  useEffect(() => {
    let cancelled = false
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    async function load() {
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) { router.replace('/?role=teacher'); return }
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || !['teacher', 'admin'].includes(profile.role)) { router.replace('/'); return }
      const { data, error } = await sb.from('vibe_publications').select('*').eq('author_id', user.id).in('format', ['vibetextbook', 'ebook']).order('updated_at', { ascending: false })
      if (cancelled) return
      if (!error) setPublications((data ?? []) as VibePublication[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  if (loading) return <div style={{ minHeight: '100dvh', color: MUTED, display: 'grid', placeItems: 'center' }}>Loading Content Studio…</div>

  return <div style={{ minHeight: '100dvh', color: TEXT, padding: '24px 16px 110px', fontFamily: 'system-ui,-apple-system,sans-serif' }}><div style={{ maxWidth: 760, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <button onClick={() => router.push('/teacher/vibelearn')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', padding: '4px 0' }}>‹ VibeLearn</button>
      <button onClick={() => router.push('/teacher/studio/governance')} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: '8px 11px' }}>Sources & history</button>
    </div>
    <h1 style={{ margin: '0 0 20px', fontSize: 28 }}>Content Studio</h1>
    <button type="button" onClick={() => { pendingCreateId.current = null; setCreateOpen(true) }} style={{ width: '100%', border: 'none', borderRadius: 14, background: ACCENT, color: '#111827', fontSize: 17, fontWeight: 800, padding: 17, cursor: 'pointer', marginBottom: 28 }}>+ Create</button>
    {createOpen && <div role="presentation" onClick={() => setCreateOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="studio-create-title" onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 id="studio-create-title" style={{ margin: 0, fontSize: 22 }}>Create content</h2><button type="button" aria-label="Close" onClick={() => setCreateOpen(false)} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 24, cursor: 'pointer' }}>×</button></div>
        <p style={{ color: MUTED, fontSize: 13 }}>What are you creating?</p>
        <div role="radiogroup" aria-label="Content type" style={{ display: 'grid', gap: 8 }}>{CREATE_OPTIONS.map(option => <label key={option.kind} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${createKind === option.kind ? ACCENT : BORDER}`, borderRadius: 12, padding: 13, cursor: 'pointer' }}><input type="radio" name="studio-content-kind" checked={createKind === option.kind} onChange={() => setCreateKind(option.kind)} /><span><strong style={{ display: 'block' }}>{option.label}</strong><small style={{ color: MUTED }}>{option.description}</small></span></label>)}</div>
        <button type="button" onClick={() => { const option = CREATE_OPTIONS.find(item => item.kind === createKind)!; const id = pendingCreateId.current ?? crypto.randomUUID(); pendingCreateId.current = id; router.push(`/teacher/studio/editor?format=${option.format}&fresh=${id}`); setCreateOpen(false) }} style={{ width: '100%', marginTop: 20, border: 'none', borderRadius: 12, padding: 14, background: ACCENT, color: '#111827', fontWeight: 800, cursor: 'pointer' }}>Continue →</button>
      </div>
    </div>}
    <section><div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: MUTED }}>YOUR CONTENT</div></div>
      <div role="group" aria-label="Filter content" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{(['all', 'draft', 'published'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} style={{ border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 12px', background: filter === value ? ACCENT : SURFACE, color: filter === value ? '#111827' : TEXT, cursor: 'pointer', textTransform: 'capitalize' }}>{value === 'draft' ? 'Drafts' : value}</button>)}</div>
      {visiblePublications.length === 0 ? <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, textAlign: 'center', color: MUTED }}>No content here yet.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{visiblePublications.map(item => <button key={item.id} onClick={() => router.push(`/teacher/studio/editor?format=${item.format === 'ebook' ? 'ebook' : 'vibetextbook'}&publication=${item.id}`)} style={{ width: '100%', textAlign: 'left', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 15, color: TEXT, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><strong style={{ fontSize: 14 }}>{item.title || 'Untitled publication'}</strong><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: item.status === 'published' ? ACCENT : MUTED, border: `1px solid ${item.status === 'published' ? 'var(--publication-accent-border)' : BORDER}`, borderRadius: 999, padding: '3px 7px' }}>{item.status.toUpperCase()}</span></div><div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{item.format === 'vibetextbook' ? 'Interactive textbook' : 'eBook'} · {item.chapter_count} {item.chapter_count === 1 ? 'unit' : 'units'} · Updated {dateLabel(item.updated_at)}</div></div><span style={{ color: ACCENT, fontSize: 20 }}>›</span></button>)}</div>}
    </section>
  </div></div>
}
