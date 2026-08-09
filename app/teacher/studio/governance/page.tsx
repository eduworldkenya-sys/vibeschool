"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { CurriculumImportDrawer } from "@/components/global/publish/CurriculumImportDrawer"
import { PublicationHistoryDrawer } from "@/components/global/publish/PublicationHistoryDrawer"

type Publication = {
  id: string
  title: string | null
  format: string
  cbc_grade: string | null
  cbc_subject: string | null
  status: string
}

export default function TeacherStudioGovernancePage() {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])
  const [authorId, setAuthorId] = useState("")
  const [publications, setPublications] = useState<Publication[]>([])
  const [publicationId, setPublicationId] = useState("")
  const [sourceOpen, setSourceOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { router.replace('/?role=teacher'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
      if (!profile || !['teacher', 'admin'].includes(profile.role)) { router.replace('/'); return }
      const { data, error: loadError } = await supabase
        .from('vibe_publications')
        .select('id,title,format,cbc_grade,cbc_subject,status')
        .eq('author_id', auth.user.id)
        .in('format', ['vibetextbook', 'ebook'])
        .order('updated_at', { ascending: false })
      if (cancelled) return
      setAuthorId(auth.user.id)
      if (loadError) setError(loadError.message)
      else {
        const rows = (data ?? []) as Publication[]
        setPublications(rows)
        setPublicationId(rows[0]?.id ?? '')
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [router, supabase])

  const selected = publications.find(item => item.id === publicationId) ?? null

  return (
    <main style={{ minHeight: '100dvh', background: '#090D16', color: '#fff', padding: '22px 16px 80px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/teacher/studio')} style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,.55)', cursor: 'pointer', padding: '0 0 18px' }}>← Content Studio</button>
        <div style={{ color: '#CCFF00', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>CREATOR GOVERNANCE</div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 27 }}>Sources & publication history</h1>
        <p style={{ color: 'rgba(255,255,255,.5)', lineHeight: 1.65, fontSize: 13, margin: '0 0 20px' }}>Register the authoritative curriculum source behind a publication and inspect the immutable snapshots created by published revisions.</p>

        {error && <div style={{ border: '1px solid rgba(248,113,113,.35)', color: '#fca5a5', borderRadius: 12, padding: 12, marginBottom: 14 }}>{error}</div>}
        {loading ? <div style={{ color: 'rgba(255,255,255,.5)' }}>Loading your publications…</div> : publications.length === 0 ? <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 18, color: 'rgba(255,255,255,.5)' }}>Create a textbook or eBook first.</div> : <>
          <label style={{ display: 'grid', gap: 7, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.65)' }}>Publication
            <select value={publicationId} onChange={event => setPublicationId(event.target.value)} style={{ width: '100%', background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,.1)', borderRadius: 11, padding: '11px 12px' }}>
              {publications.map(item => <option key={item.id} value={item.id}>{item.title || 'Untitled'} · {item.status}</option>)}
            </select>
          </label>

          {selected && <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            <button type="button" onClick={() => setSourceOpen(true)} style={actionStyle}><strong>Register curriculum source</strong><span style={actionText}>Authority, official URL/reference, curriculum, grade/form, subject and edition.</span></button>
            <button type="button" onClick={() => setHistoryOpen(true)} style={actionStyle}><strong>View revision history</strong><span style={actionText}>See snapshots created by published updates; autosaves do not count as public versions.</span></button>
          </div>}
        </>}
      </div>

      {selected && authorId && <CurriculumImportDrawer authorId={authorId} initialGrade={selected.cbc_grade} initialSubject={selected.cbc_subject} isOpen={sourceOpen} onClose={() => setSourceOpen(false)} />}
      {selected && <PublicationHistoryDrawer publicationId={selected.id} isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />}
    </main>
  )
}

const actionStyle: React.CSSProperties = { textAlign: 'left', display: 'grid', gap: 7, background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,.09)', borderRadius: 14, padding: 16, cursor: 'pointer' }
const actionText: React.CSSProperties = { color: 'rgba(255,255,255,.5)', fontSize: 11, lineHeight: 1.55 }
