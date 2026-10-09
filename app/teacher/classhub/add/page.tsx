'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [switching, setSwitching] = useState(false)
  const generation = useRef(0)

  const load = useCallback(async (expectedSchoolId?: string) => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/academy/signin?role=teacher'); return }
      const { data: context, error: contextError } = await supabase.rpc('get_my_teacher_school_context')
      if (current !== generation.current) return
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
        if (expectedSchoolId && activeSchoolId !== expectedSchoolId) {
          setError('The selected school could not be confirmed. Reload before adding a class.')
        } else if (!activeSchoolId || !available.some(school => school.id === activeSchoolId)) {
          setError('Your school must be verified before you add a class.')
        } else {
          setSchools(available)
          setSchoolId(activeSchoolId)
        }
      }
    } catch { if (current === generation.current) setError('Your verified school access could not be loaded. Please retry.') }
    finally { if (current === generation.current) setLoading(false) }
  }, [router])
  useEffect(() => { void load(); return () => { generation.current += 1 } }, [load])

  async function changeSchool(next: string) {
    setSwitching(true); setError('')
    try {
      const { error: switchError } = await supabase.rpc('set_my_active_teacher_school', { p_school_id: next })
      if (switchError) throw switchError
      await load(next)
    } catch { setError('The selected school could not be confirmed. Retry before adding a class.') }
    finally { setSwitching(false) }
  }

  return (
    <section style={{ padding: '18px 16px 34px', maxWidth: 520, margin: '0 auto' }}>
      <button type="button" onClick={() => router.back()} aria-label="Back to My Classes" style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>‹</button>
      <h1 style={{ margin: '4px 0 6px', fontSize: 26 }}>Add or join class</h1>
      <p style={{ margin: '0 0 18px', color: C.textMuted, lineHeight: 1.5 }}>Choose what you teach. Join an existing class or add a new one at your school.</p>
      {loading && <div aria-busy="true" style={{ height: 280, borderRadius: 16, background: '#f3f4f6' }} />}
      {!loading && error && <div role="alert" style={{ padding: 14, borderRadius: 12, background: '#fef2f2', color: C.error }}>{error}<button type="button" onClick={() => void load()} style={{ minHeight: 44 }}>Retry</button><button type="button" onClick={() => router.push('/teacher/onboarding/school')} style={{ display: 'block', marginTop: 12, border: 0, borderRadius: 9, padding: '10px 12px', background: C.dark, color: '#fff', fontWeight: 750 }}>School access</button></div>}
      {!loading && schools.length > 1 && <label style={{ display: 'block', marginBottom: 16, color: C.textMuted, fontSize: 12, fontWeight: 800 }}>School<select disabled={switching} value={schoolId} onChange={event => void changeSchool(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff' }}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}
      {switching && <p role="status">Confirming school…</p>}
      {!loading && !switching && !error && schoolId && <TeacherClassForm schoolId={schoolId} mode="add" />}
    </section>
  )
}
