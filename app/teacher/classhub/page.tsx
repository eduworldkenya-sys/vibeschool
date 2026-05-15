'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ClassItem {
  id:        string
  name:      string
  stream:    string
  subject:   string
  created_at: string
}

interface FormState {
  name:    string
  stream:  string
  subject: string
}

export default function ClassHubPage() {
  const router = useRouter()

  const [classes,     setClasses]     = useState<ClassItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState<string | null>(null)
  const [error,       setError]       = useState('')
  const [form,        setForm]        = useState<FormState>({ name: '', stream: '', subject: '' })

  const accent    = '#10b981'
  const dark      = '#1e1b4b'
  const cardBg    = '#ffffff'
  const border    = '#e5e7eb'
  const textMuted = '#6b7280'
  const textMain  = '#111827'

  async function loadClasses() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: true })

    setClasses(data ?? [])
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: textMuted, fontSize: 13 }}>Loading classes…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: textMuted, paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: textMain, margin: 0 }}>ClassHub</h1>
          <p style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>
            {classes.length} {classes.length === 1 ? 'class' : 'classes'}
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
              <input
                style={inputStyle}
                placeholder="e.g. Grade 6B"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Mathematics"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Stream (optional)</label>
              <input
                style={inputStyle}
                placeholder="e.g. East"
                value={form.stream}
                onChange={e => setForm(f => ({ ...f, stream: e.target.value }))}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 12, background: saving ? '#d1fae5' : accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving…' : 'Create Class'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {classes.length === 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 16px', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🏫</span>
          <p style={{ fontSize: 14, color: textMuted, textAlign: 'center' }}>No classes yet. Tap <strong>+ Add Class</strong> to get started.</p>
        </div>
      )}

      {/* Class list */}
      {classes.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes.map(cls => (
            <div
              key={cls.id}
              style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: textMain, margin: 0 }}>
                    {cls.name}{cls.stream ? ` · ${cls.stream}` : ''}
                  </p>
                  <p style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>{cls.subject}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
          ))}
        </div>
      )}

    </div>
  )
}
