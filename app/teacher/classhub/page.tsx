'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ClassItem {
  id:         string
  name:       string
  stream:     string
  subject:    string
  created_at: string
}

interface FormState {
  name:    string
  stream:  string
  subject: string
}

const accent    = '#10b981'
const dark      = '#1e1b4b'
const cardBg    = '#ffffff'
const border    = '#e5e7eb'
const textMuted = '#6b7280'
const textMain  = '#111827'

function Skeleton({ h = 72 }: { h?: number }) {
  return (
    <div style={{
      height: h,
      borderRadius: 16,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function ClassHubPage() {
  const router = useRouter()

  const [classes,       setClasses]       = useState<ClassItem[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [error,         setError]         = useState('')
  const [form,          setForm]          = useState<FormState>({ name: '', stream: '', subject: '' })

  async function loadClasses() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: true })

    const cls = classData ?? []
    setClasses(cls)

    if (cls.length > 0) {
      const ids = cls.map(c => c.id)
      const { data: students } = await supabase
        .from('students')
        .select('class_id')
        .in('class_id', ids)

      const counts: Record<string, number> = {}
      for (const s of students ?? []) {
        counts[s.class_id] = (counts[s.class_id] ?? 0) + 1
      }
      setStudentCounts(counts)
    }

    setLoading(false)
  }

  useEffect(() => { loadClasses() }, [])

  async function handleCreate() {
    setError('')
    if (!form.name.trim())    { setError('Class name is required.'); return }
    if (!form.subject.trim()) { setError('Subject is required.'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase
      .from('classes')
      .insert({
        teacher_id: user.id,
        name:       form.name.trim(),
        stream:     form.stream.trim(),
        subject:    form.subject.trim(),
      })

    setSaving(false)
    if (err) { setError(err.message); return }

    setForm({ name: '', stream: '', subject: '' })
    setShowForm(false)
    loadClasses()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('classes').delete().eq('id', id)
    setDeleting(null)
    loadClasses()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    fontSize: 14,
    color: textMain,
    outline: 'none',
    fontFamily: 'inherit',
    background: '#f9fafb',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: textMuted, paddingBottom: 32 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: textMain, margin: 0 }}>ClassHub</h1>
          <p style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>
            {loading ? '…' : `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          style={{ padding: '10px 18px', borderRadius: 12, background: showForm ? '#f3f4f6' : dark, color: showForm ? textMain : '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {showForm ? 'Cancel' : '+ Add Class'}
        </button>
      </div>

      {/* Add class form */}
      {showForm && (
        <div style={{ margin: '0 16px 16px', padding: 20, background: cardBg, borderRadius: 16, border: `1px solid ${border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: textMain, marginBottom: 16 }}>New Class</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Class Name *</label>
              <input style={inputStyle} placeholder="e.g. Grade 6B" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input style={inputStyle} placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Stream (optional)</label>
              <input style={inputStyle} placeholder="e.g. East" value={form.stream} onChange={e => setForm(f => ({ ...f, stream: e.target.value }))} />
            </div>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 12, background: saving ? '#d1fae5' : accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving…' : 'Create Class'}
          </button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && classes.length === 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 16px', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🏫</span>
          <p style={{ fontSize: 14, color: textMuted, textAlign: 'center' }}>No classes yet. Tap <strong>+ Add Class</strong> to get started.</p>
        </div>
      )}

      {/* Class list */}
      {!loading && classes.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes.map(cls => {
            const count = studentCounts[cls.id] ?? 0
            return (
              <div key={cls.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: textMain, margin: 0 }}>
                      {cls.name}{cls.stream ? ` · ${cls.stream}` : ''}
                    </p>
                    <p style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>{cls.subject}</p>
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px' }}>
                      <span style={{ fontSize: 12 }}>👥</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>
                        {count} {count === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                    <button
                      onClick={() => router.push(`/teacher/classhub/${cls.id}`)}
                      style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(cls.id)}
                      disabled={deleting === cls.id}
                      style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {deleting === cls.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}