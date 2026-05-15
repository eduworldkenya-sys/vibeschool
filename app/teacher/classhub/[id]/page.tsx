'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Student {
  id: string
  name: string
  admission_number: string
  created_at: string
}

interface ClassInfo {
  name: string
  stream: string
  subject: string
}

interface FormState {
  name: string
  admission_number: string
}

export default function StudentsPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.id as string

  const [classInfo,  setClassInfo]  = useState<ClassInfo | null>(null)
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [error,      setError]      = useState('')
  const [form,       setForm]       = useState<FormState>({ name: '', admission_number: '' })

  const accent    = '#10b981'
  const dark      = '#1e1b4b'
  const cardBg    = '#ffffff'
  const border    = '#e5e7eb'
  const textMuted = '#6b7280'
  const textMain  = '#111827'

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const { data: cls } = await supabase
      .from('classes')
      .select('name, stream, subject')
      .eq('id', classId)
      .eq('teacher_id', user.id)
      .single()

    if (!cls) { router.push('/teacher/classhub'); return }
    setClassInfo(cls)

    const { data: studs } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: true })

    setStudents(studs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [classId])

  async function handleAdd() {
    setError('')
    if (!form.name.trim()) { setError("Student name is required."); return }

    setSaving(true)
    const { error: err } = await supabase
      .from('students')
      .insert({
        class_id:         classId,
        name:             form.name.trim(),
        admission_number: form.admission_number.trim(),
      })
    setSaving(false)

    if (err) { setError(err.message); return }

    setForm({ name: '', admission_number: '' })
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('students').delete().eq('id', id)
    setDeleting(null)
    loadData()
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
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    display: 'block',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: textMuted, fontSize: 13 }}>Loading students…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: textMuted, paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.push('/teacher/classhub')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: textMain, margin: 0 }}>
            {classInfo?.name}{classInfo?.stream ? ` · ${classInfo.stream}` : ''}
          </h1>
          <p style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>
            {classInfo?.subject} · {students.length} {students.length === 1 ? 'student' : 'students'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          style={{ padding: '10px 16px', borderRadius: 12, background: showForm ? '#f3f4f6' : dark, color: showForm ? textMain : '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add student form */}
      {showForm && (
        <div style={{ margin: '0 16px 16px', padding: 20, background: cardBg, borderRadius: 16, border: `1px solid ${border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: textMain, marginBottom: 16 }}>New Student</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Amara Osei"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Admission Number (optional)</label>
              <input
                style={inputStyle}
                placeholder="e.g. ADM/2024/001"
                value={form.admission_number}
                onChange={e => setForm(f => ({ ...f, admission_number: e.target.value }))}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>
          )}

          <button
            onClick={handleAdd}
            disabled={saving}
            style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 12, background: saving ? '#d1fae5' : accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving…' : 'Add Student'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {students.length === 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 16px', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🎒</span>
          <p style={{ fontSize: 14, color: textMuted, textAlign: 'center' }}>
            No students yet. Tap <strong>+ Add</strong> to get started.
          </p>
        </div>
      )}

      {/* Student list */}
      {students.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {students.map((s, i) => (
            <div
              key={s.id}
              style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: dark }}>
                  {i + 1}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textMain, margin: 0 }}>{s.name}</p>
                  {s.admission_number && (
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{s.admission_number}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deleting === s.id}
                style={{ padding: '6px 12px', borderRadius: 10, border: '1.5px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {deleting === s.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}