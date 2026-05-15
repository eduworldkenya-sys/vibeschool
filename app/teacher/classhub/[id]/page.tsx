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

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 8,
      background: 'linear-gradient(90deg,rgba(255,255,255,0.15) 25%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.15) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function SkeletonLight({ h = 16, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 8,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

const ACTIONS = [
  { id: 'students',   label: 'Students',     icon: '👥', bg: '#1e1b4b', iconBg: 'rgba(255,255,255,0.15)', route: '' },
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', iconBg: 'rgba(255,255,255,0.15)', route: '/teacher/attendance' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', iconBg: 'rgba(255,255,255,0.15)', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', iconBg: 'rgba(255,255,255,0.15)', route: '/teacher/assessment' },
  { id: 'timetable',  label: 'Timetable',    icon: '📅', bg: '#075985', iconBg: 'rgba(255,255,255,0.15)', route: '/teacher/timetable' },
  { id: 'resources',  label: 'Resources',    icon: '📁', bg: '#7e22ce', iconBg: 'rgba(255,255,255,0.15)', route: '/teacher/resources' },
  { id: 'groups',     label: 'Groups',       icon: '🫂', bg: '#b45309', iconBg: 'rgba(255,255,255,0.15)', route: '' },
  { id: 'homework',   label: 'Homework',     icon: '📝', bg: '#0f766e', iconBg: 'rgba(255,255,255,0.15)', route: '' },
]

const NOTICES = [
  { id: '1', icon: '📋', text: 'No recent activity', sub: 'Class updates will appear here', color: '#6b7280' },
]

export default function ClassPage() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [classInfo,  setClassInfo]  = useState<ClassInfo | null>(null)
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showRoster, setShowRoster] = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [error,      setError]      = useState('')
  const [form,       setForm]       = useState<FormState>({ name: '', admission_number: '' })

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

  function handleAction(a: typeof ACTIONS[0]) {
    if (a.id === 'students') { setShowRoster(v => !v); return }
    if (a.route) router.push(a.route + '?classId=' + classId)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: '#111827',
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b7280', paddingBottom: 60, background: '#f8f9fa', minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #10b981 150%)',
        padding: '20px 16px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(16,185,129,0.12)' }} />

        {/* Back + actions row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={() => router.push('/teacher/classhub')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
          >
            ←
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>🔔</button>
            <button style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>⚙️</button>
          </div>
        </div>

        {/* Class identity */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton h={28} w="60%" />
            <Skeleton h={14} w="40%" />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Skeleton h={36} w="30%" />
              <Skeleton h={36} w="30%" />
              <Skeleton h={36} w="30%" />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏫</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {classInfo?.name}{classInfo?.stream ? ' · ' + classInfo.stream : ''}
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>{classInfo?.subject}</p>
              </div>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                { label: 'Students', value: students.length },
                { label: 'Present', value: '—' },
                { label: 'Avg Score', value: '—' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>Class Tools</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => handleAction(a)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 4px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: a.bg, fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── STUDENT ROSTER (expandable) ── */}
      {showRoster && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideDown 0.2s ease' }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>Student Roster</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{students.length} enrolled</p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              style={{ padding: '8px 14px', borderRadius: 10, background: showForm ? '#f3f4f6' : '#1e1b4b', color: showForm ? '#111827' : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showForm && (
            <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
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
                style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 10, background: saving ? '#d1fae5' : '#10b981', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'Saving…' : 'Add Student'}
              </button>
            </div>
          )}

          {students.length === 0 && !showForm && (
            <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🎒</span>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: 0 }}>No students yet. Tap <strong>+ Add</strong> to enrol.</p>
            </div>
          )}

          {students.length > 0 && (
            <div>
              {students.map((s, i) => (
                <div key={s.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#1e1b4b', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{s.name}</p>
                      {s.admission_number && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{s.admission_number}</p>}
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
      )}

      {/* ── NOTIFICATIONS / ACTIVITY ── */}
      <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', letterSpacing: 1.4, textTransform: 'uppercase', margin: 0 }}>Class Activity</p>
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>View all</span>
        </div>
        {NOTICES.map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{n.icon}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{n.text}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{n.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── PERFORMANCE SNAPSHOT ── */}
      <div style={{ margin: '14px 16px 0', background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', borderRadius: 20, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 14px' }}>Performance</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Attendance Rate', value: '—%', icon: '📊' },
            { label: 'Avg Score',       value: '—',   icon: '🏆' },
            { label: 'Homework Done',   value: '—%',  icon: '📝' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
