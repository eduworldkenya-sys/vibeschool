'use client'
import { C } from '@/components/teacher/ui'

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

interface SubjectOption {
  id:   string
  name: string
}

interface FormState {
  name:    string
  stream:  string
  subject: string
}

const GRADES = [
  'PP1','PP2',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9',
]

const accent    = C.accent
const dark      = C.dark
const cardBg    = C.bg
const border    = C.border
const textMuted = C.textMuted
const textMain  = C.textPrimary

function Skeleton({ h = 72 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 16,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function ClassHubPage() {
  const router = useRouter()

  const [designation,   setDesignation]   = useState<string | null>(null)
  const [checkingRole,  setCheckingRole]  = useState(true)
  const [savingRole,    setSavingRole]    = useState(false)

  const [classes,       setClasses]       = useState<ClassItem[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [subjects,      setSubjects]      = useState<SubjectOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [error,         setError]         = useState('')
  const [userId,        setUserId]        = useState<string | null>(null)
  const [schoolId,      setSchoolId]      = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }
    setUserId(user.id)

    const [teacherRes, memberRes, profileRes] = await Promise.all([
      supabase.from('teacher_profiles').select('designation, school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profiles').select('school_id').eq('id', user.id).single(),
    ])

    const desig = teacherRes.data?.designation ?? null
    const sid   = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
    setSchoolId(sid)
    setDesignation(desig)
    setCheckingRole(false)

    if (desig === 'subject_teacher') { router.push('/teacher/subjecthub'); return }
    if (desig === 'class_teacher') { await loadClasses(user.id, sid) }
  }

  async function pickRole(role: 'class_teacher' | 'subject_teacher') {
    if (!userId) return
    setSavingRole(true)
    await supabase.from('teacher_profiles').upsert({ profile_id: userId, designation: role }, { onConflict: 'profile_id' })
    setSavingRole(false)
    setDesignation(role)
    if (role === 'subject_teacher') { router.push('/teacher/subjecthub'); return }
    await loadClasses(userId, schoolId)
  }

  async function loadClasses(uid: string, sid: string | null) {
    setLoading(true)

    const subjectQuery = sid
      ? supabase.from('subjects').select('id, name').or(`school_id.eq.${sid},school_id.is.null`).order('name')
      : supabase.from('subjects').select('id, name').order('name')

    // Load class IDs where this teacher is the class teacher
    const tcClassRes = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', uid)
      .eq('is_class_teacher', true)

    const classIds = Array.from(new Set(
      (tcClassRes.data ?? []).map((r: { class_id: string }) => r.class_id).filter(Boolean)
    ))

    const classQuery = classIds.length > 0
      ? supabase.from('classes').select('*').in('id', classIds).order('created_at', { ascending: true })
      : supabase.from('classes').select('*').eq('teacher_id', uid).order('created_at', { ascending: true })

    const [classRes, subjectRes] = await Promise.all([classQuery, subjectQuery])

    const cls = classRes.data ?? []
    setClasses(cls)
    setSubjects(subjectRes.data ?? [])

    if (cls.length > 0) {
      const ids = cls.map(c => c.id)
      const { data: students } = await supabase.from('students').select('class_id').in('class_id', ids)
      const counts: Record<string, number> = {}
      for (const s of students ?? []) { counts[s.class_id] = (counts[s.class_id] ?? 0) + 1 }
      setStudentCounts(counts)
    }

    setLoading(false)
  }


  async function handleDelete(id: string) {
    if (!window.confirm('Delete this class? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('classes').delete().eq('id', id)
    setDeleting(null)
    if (userId) await loadClasses(userId, schoolId)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: textMain,
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, display: 'block',
  }

  if (checkingRole) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 24 }}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton h={28} /><Skeleton h={140} /><Skeleton h={140} />
        </div>
      </div>
    )
  }

  if (!designation) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 24, minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: textMain, margin: '0 0 8px' }}>What kind of teacher are you?</h1>
          <p style={{ fontSize: 14, color: textMuted, margin: 0 }}>This helps us set up the right tools for you.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={() => pickRole('class_teacher')} disabled={savingRole} style={{ padding: '24px 20px', borderRadius: 20, border: '2px solid #1e1b4b', background: dark, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: savingRole ? 0.7 : 1 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🏫</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Class Teacher</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>You manage a specific class. You can create your class, add students, track attendance, and run the full class ecosystem.</div>
          </button>
          <button onClick={() => pickRole('subject_teacher')} disabled={savingRole} style={{ padding: '24px 20px', borderRadius: 20, border: '2px solid #e5e7eb', background: cardBg, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: savingRole ? 0.7 : 1 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔬</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: textMain, marginBottom: 6 }}>Subject Teacher</div>
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.5 }}>You teach a subject across multiple classes. Access your SubjectHub, lesson plans, and department tools.</div>
          </button>
        </div>
        {savingRole && <p style={{ textAlign: 'center', fontSize: 13, color: textMuted, marginTop: 20 }}>Setting up your workspace…</p>}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: textMuted, paddingBottom: 32 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: textMain, margin: 0 }}>ClassHub</h1>
          <p style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>{loading ? '…' : `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}</p>
        </div>
      </div>


      {loading && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} />)}
        </div>
      )}

      {!loading && classes.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 16px', gap: 12 }}>
          <span style={{ fontSize: 40 }}>🏫</span>
          <p style={{ fontSize: 14, color: textMuted, textAlign: 'center' }}>No classes yet. Create one from Settings → My Classes.</p>
        </div>
      )}

      {!loading && classes.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes.map(cls => {
            const count = studentCounts[cls.id] ?? 0
            return (
              <div key={cls.id} style={{ background: cardBg, border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: textMain, margin: 0 }}>{cls.name}{cls.stream ? ' · ' + cls.stream : ''}</p>
                    <p style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>{cls.subject}</p>
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px' }}>
                      <span style={{ fontSize: 12 }}>👥</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{count} {count === 1 ? 'student' : 'students'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                    <button onClick={() => router.push('/teacher/classhub/' + cls.id)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid ' + accent, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Open</button>
                    <button onClick={() => handleDelete(cls.id)} disabled={deleting === cls.id} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #fca5a5', background: 'transparent', color: C.error, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
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
