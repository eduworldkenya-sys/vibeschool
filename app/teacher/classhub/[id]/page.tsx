'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Student {
  id:               string
  name:             string
  admission_number: string
  created_at:       string
}

interface ClassInfo {
  name:    string
  stream:  string
  subject: string
}

interface FormState {
  name:             string
  admission_number: string
}

const accent    = '#10b981'
const dark      = '#1e1b4b'
const cardBg    = '#ffffff'
const border    = '#e5e7eb'
const textMuted = '#6b7280'
const textMain  = '#111827'

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h,
      borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function ComingSoon({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ margin: '0 16px', padding: '28px 20px', background: cardBg, border: `1px solid ${border}`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <p style={{ fontSize: 14, fontWeight: 700, color: textMain, margin: 0 }}>{label}</p>
      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 14px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Coming Soon</span>
      </div>
      <p style={{ fontSize: 12, color: textMuted, textAlign: 'center', margin: 0 }}>
        {"This section will be available in the next update."}
      </p>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: '24px 16px 10px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{subtitle}</p>}
    </div>
  )
}

export default function ClassPage() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [students,  setStudents]  = useState<Student[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [error,     setError]     = useState('')
  const [form,      setForm]      = useState<FormState>({ name: '', admission_number: '' })

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const [clsRes, studsRes] = await Promise.all([
      supabase.from('classes').select('name, stream, subject').eq('id', classId).eq('teacher_id', user.id).single(),
      supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: true }),
    ])

    if (!clsRes.data) { router.push('/teacher/classhub'); return }
    setClassInfo(clsRes.data)
    setStudents(studsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [classId])

  async function handleAdd() {
    setError('')
    if (!form.name.trim()) { setError('Student name is required.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('students').insert({
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
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: textMuted, paddingBottom: 48 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Class Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={() => router.push('/teacher/classhub')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '2px 0', lineHeight: 1, color: textMain }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton h={24} /><Skeleton h={16} />
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: textMain, margin: 0 }}>
                {classInfo?.name}{classInfo?.stream ? ` · ${classInfo.stream}` : ''}
              </h1>
              <p style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>
                {classInfo?.subject} · {students.length} {students.length === 1 ? 'student' : 'students'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── STUDENTS ── */}
      <div style={{ margin: '0 16px', background: cardBg, border: `1px solid ${border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>👥</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: textMain, margin: 0 }}>Students</p>
              {!loading && <p style={{ fontSize: 11, color: textMuted, marginTop: 1 }}>{students.length} enrolled</p>}
            </div>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError('') }}
            style={{ padding: '8px 14px', borderRadius: 10, background: showForm ? '#f3f4f6' : dark, color: showForm ? textMain : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {showForm && (
          <div style={{ padding: '16px', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input style={inputStyle} placeholder="e.g. Amara Osei" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Admission Number (optional)</label>
                <input style={inputStyle} placeholder="e.g. ADM/2024/001" value={form.admission_number} onChange={e => setForm(f => ({ ...f, admission_number: e.target.value }))} />
              </div>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 10, background: saving ? '#d1fae5' : accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {saving ? 'Saving…' : 'Add Student'}
            </button>
          </div>
        )}

        {loading && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} />)}
          </div>
        )}

        {!loading && students.length === 0 && !showForm && (
          <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 32 }}>🎒</span>
            <p style={{ fontSize: 13, color: textMuted, textAlign: 'center' }}>
              No students yet. Tap <strong>+ Add</strong> to enrol the first student.
            </p>
          </div>
        )}

        {!loading && students.length > 0 && (
          <div>
            {students.map((s, i) => (
              <div key={s.id} style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i === 0 ? 'none' : `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: dark, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: textMain, margin: 0 }}>{s.name}</p>
                    {s.admission_number && <p style={{ fontSize: 11, color: textMuted, marginTop: 1 }}>{s.admission_number}</p>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deleting === s.id}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {deleting === s.id ? '…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ATTENDANCE ── */}
      <SectionHeader title="Attendance" subtitle="Track daily student attendance" />
      <ComingSoon label="Attendance" icon="✅" />

      {/* ── LESSON PLANS ── */}
      <SectionHeader title="Lesson Plans" subtitle="Weekly plans for this class" />
      <ComingSoon label="Lesson Plans" icon="📖" />

      {/* ── ASSESSMENT ── */}
      <SectionHeader title="Assessment" subtitle="Marks and performance" />
      <ComingSoon label="Assessment" icon="📊" />

      {/* ── TIMETABLE ── */}
      <SectionHeader title="Timetable" subtitle="Scheduled slots for this class" />
      <ComingSoon label="Timetable" icon="📅" />

    </div>
  )
}