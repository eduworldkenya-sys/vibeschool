'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

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

const CLASS_ACTIONS = [
  { id: 'students',   label: 'Students',     icon: '👥', bg: '#1e1b4b', route: '' },
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
  { id: 'timetable',  label: 'Timetable',    icon: '📅', bg: '#075985', route: '/teacher/timetable' },
  { id: 'resources',  label: 'Resources',    icon: '📁', bg: '#7e22ce', route: '/teacher/resources' },
  { id: 'groups',     label: 'Groups',       icon: '🫂', bg: '#b45309', route: '' },
  { id: 'homework',   label: 'Homework',     icon: '📝', bg: '#0f766e', route: '' },
]

const SUBJECT_ACTIONS = [
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
  { id: 'scheme',     label: 'Scheme',       icon: '📋', bg: '#0f4c75', route: '/teacher/scheme' },
  { id: 'resources',  label: 'Resources',    icon: '📁', bg: '#7e22ce', route: '/teacher/resources' },
  { id: 'timetable',  label: 'Timetable',    icon: '📅', bg: '#075985', route: '/teacher/timetable' },
]

const NOTICES = [
  { id: '1', icon: '📋', text: 'No recent activity', sub: 'Class updates will appear here' },
]

function ClassPageInner() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const classId      = params.id as string
  const mode         = searchParams.get('mode') ?? 'class'
  const subjectId    = searchParams.get('subjectId') ?? ''
  const isSubject    = mode === 'subject'

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

    const classQuery = isSubject
      ? supabase.from('classes').select('name, stream, subject').eq('id', classId).single()
      : supabase.from('classes').select('name, stream, subject').eq('id', classId).eq('teacher_id', user.id).single()

    const [clsRes, studsRes] = await Promise.all([
      classQuery,
      supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: true }),
    ])

    if (!clsRes.data) { router.push(isSubject ? '/teacher/subjecthub' : '/teacher/classhub'); return }
    setClassInfo(clsRes.data)
    setStudents(studsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [classId, mode])

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

  function buildRoute(baseRoute: string) {
    if (!baseRoute) return ''
    let r = baseRoute + '?classId=' + classId
    if (isSubject && subjectId) r += '&subjectId=' + subjectId
    return r
  }

  function handleAction(a: { id: string; route: string }) {
    if (a.id === 'students') { setShowRoster(v => !v); return }
    const r = buildRoute(a.route)
    if (r) router.push(r)
  }

  const actions        = isSubject ? SUBJECT_ACTIONS : CLASS_ACTIONS
  const heroGradient   = isSubject
    ? 'linear-gradient(135deg, #075985 0%, #0369a1 60%, #0ea5e9 150%)'
    : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #10b981 150%)'
  const backRoute      = isSubject ? '/teacher/subjecthub' : '/teacher/classhub'
  const gridCols       = isSubject ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'

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

      {/* HERO */}
      <div style={{ background: heroGradient, padding: '20px 16px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={() => router.push(backRoute)}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
          >←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSubject ? (
              <div style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>
                Subject View
              </div>
            ) : (
              <>
                <button style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>🔔</button>
                <button style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>⚙️</button>
              </>
            )}
          </div>
        </div>

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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {isSubject ? '📚' : '🏫'}
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {isSubject
                    ? classInfo?.subject
                    : (classInfo?.name + (classInfo?.stream ? ' · ' + classInfo.stream : ''))}
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>
                  {isSubject
                    ? (classInfo?.name + (classInfo?.stream ? ' · ' + classInfo.stream : ''))
                    : classInfo?.subject}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                { label: 'Students',                              value: students.length },
                { label: 'Present',                               value: '—' },
                { label: isSubject ? 'Subject Avg' : 'Avg Score', value: '—' },
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

      {/* QUICK ACTIONS */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>
          {isSubject ? 'Subject Tools' : 'Class Tools'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}>
          {actions.map(a => (
            <button
              key={a.id}
              onClick={() => handleAction(a)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', background: a.bg, fontFamily: 'inherit' }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STUDENT LIST */}
      {(isSubject || showRoster) && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideDown 0.2s ease' }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>
                {isSubject ? 'Class Students' : 'Student Roster'}
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{students.length} enrolled</p>
            </div>
            {!isSubject && (
              <button
                onClick={() => setShowForm(v => !v)}
                style={{ padding: '8px 14px', borderRadius: 10, background: showForm ? '#f3f4f6' : '#1e1b4b', color: showForm ? '#111827' : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {showForm ? 'Cancel' : '+ Add'}
              </button>
            )}
          </div>

          {!isSubject && showForm && (
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

          {loading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🎒</span>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: 0 }}>
                {isSubject ? 'No students enrolled in this class.' : 'No students yet. Tap + Add to enrol.'}
              </p>
            </div>
          ) : (
            <div>
              {students.map((s, i) => (
                <div key={s.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: isSubject ? '#e0f2fe' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: isSubject ? '#075985' : '#1e1b4b', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{s.name}</p>
                      {s.admission_number && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{s.admission_number}</p>}
                    </div>
                  </div>
                  {!isSubject && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {deleting === s.id ? '…' : 'Delete'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isSubject && !showRoster && (
        <div style={{ margin: '14px 16px 0' }}>
          <button
            onClick={() => setShowRoster(true)}
            style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1.5px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            👥 View Student Roster ({students.length})
          </button>
        </div>
      )}

      {/* CLASS ACTIVITY */}
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

      {/* PERFORMANCE SNAPSHOT */}
      <div style={{ margin: '14px 16px 0', background: isSubject ? 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)' : 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', borderRadius: 20, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 14px' }}>
          {isSubject ? 'Subject Performance' : 'Performance'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Attendance Rate',                           value: '—%', icon: '📊' },
            { label: isSubject ? 'Subject Avg' : 'Avg Score',    value: '—',  icon: '🏆' },
            { label: 'Homework Done',                             value: '—%', icon: '📝' },
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

export default function ClassPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 56, borderRadius: 12, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
      </div>
    }>
      <ClassPageInner />
    </Suspense>
  )
}
