"use client";

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { VibePublication } from '@/lib/publishTypes'
import { PublicationEditor } from '@/components/global/publish/PublicationEditor'

const BG = '#090D16'
const SURF = '#111827'
const ACCENT = '#CCFF00'
const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'
const CARD = '#1a2235'

export default function EbookStudioPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [books, setBooks] = useState<VibePublication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    sb.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) { router.replace('/'); return }
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['teacher', 'admin'].includes(profile.role)) { router.replace('/'); return }
      setUserId(user.id)
      const { data } = await sb.from('vibe_publications').select('*').eq('author_id', user.id).eq('format', 'ebook').order('updated_at', { ascending: false })
      setBooks((data || []) as VibePublication[])
      setLoading(false)
    })
  }, [router])

  if (!userId) return null
  if (showEditor) return <PublicationEditor authorId={userId} format="ebook" publicationId={selectedId} />

  return <div style={{ background: BG, minHeight: '100dvh', color: TEXT, padding: '24px 16px', fontFamily: 'system-ui,-apple-system,sans-serif' }}><div style={{ maxWidth: 600, margin: '0 auto' }}><button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 22, cursor: 'pointer', marginBottom: 20, padding: '4px 8px' }}>‹</button><h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em' }}>📚 eBook Studio</h1><p style={{ color: MUTED, fontSize: 13, margin: '0 0 28px' }}>Create structured books with chapters, rich learning blocks and one publication lifecycle.</p><button onClick={() => { setSelectedId(undefined); setShowEditor(true) }} style={{ width: '100%', padding: 14, background: ACCENT, color: BG, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 28 }}>+ New eBook</button><div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: 12 }}>YOUR EBOOKS</div>{loading ? <div style={{ color: MUTED, fontSize: 13 }}>Loading…</div> : books.length === 0 ? <div style={{ background: SURF, border: '1px solid ' + BORDER, borderRadius: 12, padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>No eBooks yet. Start your first one.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{books.map(book => <div key={book.id} onClick={() => { setSelectedId(book.id); setShowEditor(true) }} style={{ background: CARD, border: '1px solid ' + BORDER, borderRadius: 12, padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{book.title || 'Untitled eBook'}</span><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: book.status === 'published' ? ACCENT : MUTED, border: '1px solid ' + (book.status === 'published' ? ACCENT : BORDER) }}>{book.status === 'published' ? 'LIVE' : book.status.toUpperCase()}</span></div><div style={{ fontSize: 11, color: MUTED }}>Updated {new Date(book.updated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div><span style={{ color: ACCENT, fontSize: 18 }}>›</span></div>)}</div>}</div></div>
}
