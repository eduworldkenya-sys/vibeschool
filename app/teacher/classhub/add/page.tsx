'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TeacherClassForm from '@/components/teacher/TeacherClassForm'
import { C } from '@/components/teacher/ui'

type SchoolOption = { id: string; name: string }

export default function AddTeacherClassPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schools, setSchools] = useState<SchoolOption[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/academy/signin?role=teacher'); return }
      const { data: context, error: contextError } = await supabase.rpc('get_my_teacher_school_context')
      if (cancelled) return
      if (contextError) {
        setError('Your verified school access could not be loaded.')
      } else {
        const schoolContext = context as {
          active_school_id?: string | null
          schools?: Array<{ id?: string | null; name?: string | null }>
        } | null
        const available = (schoolContext?.schools ?? [])
          .filter((school): school is { id: string; name?: string | null } => Boolean(school.id))
          .map(school => ({ id: school.id, name: school.name ?? 'School' }))
        const activeSchoolId = schoolContext?.active_school_id ?? null
        if (!activeSchoolId) {
          setError('Your school must be verified before you add a class.')
        } else {
          setSchools(available)
          setSchoolId(activeSchoolId)
        }
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  return (
    <main style={{ padding: '18px 16px 34px', maxWidth: 520, margin: '0 auto' }}>
      <button type="button" onClick={() => router.back()} aria-label="Back to My Classes" style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>‹</button>
      <h1 style={{ margin: '4px 0 6px', fontSize: 26 }}>Add or join class</h1>
      <p style={{ margin: '0 0 18px', color: C.textMuted, lineHeight: 1.5 }}>Choose what you teach. Existing school classes and canonical subjects are reused instead of creating duplicates.</p>
      {loading && <div aria-busy="true" style={{ height: 280, borderRadius: 16, background: '#f3f4f6' }} />}
      {!loading && error && <div role="alert" style={{ padding: 14, borderRadius: 12, background: '#fef2f2', color: C.error }}>{error}<button type="button" onClick={() => router.push('/teacher/onboarding/school')} style={{ display: 'block', marginTop: 12, border: 0, borderRadius: 9, padding: '10px 12px', background: C.dark, color: '#fff', fontWeight: 750 }}>School access</button></div>}
      {!loading && schools.length > 1 && <label style={{ display: 'block', marginBottom: 16, color: C.textMuted, fontSize: 12, fontWeight: 800 }}>School<select value={schoolId} onChange={event => setSchoolId(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff' }}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}
      {!loading && !error && schoolId && <TeacherClassForm schoolId={schoolId} mode="add" />}
    </main>
  )
}
