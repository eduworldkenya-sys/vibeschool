'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  dark:    '#1e1b4b',
  accent:  '#10b981',
  bg:      '#f0f4f8',
  surface: '#ffffff',
  border:  '#e2e8f0',
  text:    '#0f172a',
  muted:   '#64748b',
  error:   '#ef4444',
}

interface StudentRow {
  id:               string
  name:             string
  admission_number: string | null
  class_id:         string | null
  school_id:        string | null
}

function HarmonizeInner() {
  const router  = useRouter()
  const params  = useSearchParams()
  const sid     = params.get('sid')

  const [loading,      setLoading]      = useState(true)
  const [linking,      setLinking]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)
  const [student,      setStudent]      = useState<StudentRow | null>(null)
  const [className,    setClassName]    = useState('')
  const [schoolName,   setSchoolName]   = useState('')
  const [alreadyLinked, setAlreadyLinked] = useState(false)

  useEffect(() => {
    if (!sid) { setError("Invalid link. No student ID found."); setLoading(false); return }
    load()
  }, [sid])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/academy/signin?role=parent&next=/parent/harmonize?sid=' + sid)
      return
    }

    const [stuRes, linkRes] = await Promise.all([
      supabase.from('students').select('id, name, admission_number, class_id, school_id').eq('id', sid).single(),
      supabase.from('parent_student_links').select('student_id').eq('parent_id', user.id).eq('student_id', sid),
    ])

    if (!stuRes.data) { setError("Student not found. The link may be invalid or expired."); setLoading(false); return }
    setStudent(stuRes.data)

    if ((linkRes.data ?? []).length > 0) { setAlreadyLinked(true); setLoading(false); return }

    if (stuRes.data.class_id) {
      const { data: cls } = await supabase.from('classes').select('name, school_id').eq('id', stuRes.data.class_id).single()
      if (cls) {
        setClassName(cls.name)
        if (cls.school_id) {
          const { data: sch } = await supabase.from('schools').select('name').eq('id', cls.school_id).single()
          if (sch) setSchoolName(sch.name)
        }
      }
    }

    setLoading(false)
  }

  async function handleConfirm() {
    if (!sid) return
    setLinking(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=parent'); return }

    const { error: linkErr } = await supabase.from('parent_student_links').insert({
      parent_id:  user.id,
      student_id: sid,
    })

    if (linkErr) { setError(linkErr.message); setLinking(false); return }

    setSuccess(true)
    setLinking(false)
    setTimeout(() => router.push('/parent'), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: C.muted }}>Loading…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: C.muted }}>{error}</div>
      </div>
    </div>
  )

  if (alreadyLinked) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Already linked</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>You are already connected to {student?.name}.</div>
        <button onClick={() => router.push('/parent')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: C.dark, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Go to Dashboard
        </button>
      </div>
    </div>
  )

  if (success) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Successfully linked!</div>
        <div style={{ fontSize: 13, color: C.muted }}>You are now connected to {student?.name}. Redirecting…</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '0 0 40px' }}>

      <div style={{ background: C.dark, padding: '20px 20px 28px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>V</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>VibeSchool</div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Parent Portal</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>Connect to Child</div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: C.surface, borderRadius: 16, padding: 20, border: '1px solid ' + C.border }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>📋 School Record</div>
          {[
            { label: 'Name',      value: student?.name ?? '—' },
            { label: 'Admission', value: student?.admission_number ?? '—' },
            { label: 'Class',     value: className || '—' },
            { label: 'School',    value: schoolName || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: C.muted }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#065f46', marginBottom: 6 }}>✅ Confirm connection</div>
          <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.6 }}>
            By tapping confirm, you are linking your parent account to this student. You will be able to view their progress, attendance, and results.
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: C.error }}>
            {error}
          </div>
        )}

        <button onClick={handleConfirm} disabled={linking} style={{ padding: '14px', borderRadius: 12, border: 'none', background: linking ? C.muted : C.accent, color: '#fff', fontWeight: 800, fontSize: 15, cursor: linking ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {linking ? "Linking…" : "✅ Confirm — This is my child"}
        </button>

        <button onClick={() => router.push('/parent')} style={{ padding: '12px', borderRadius: 12, border: '1.5px solid ' + C.border, background: 'transparent', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>

      </div>
    </div>
  )
}

export default function HarmonizePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>Loading…</div>}>
      <HarmonizeInner />
    </Suspense>
  )
}
