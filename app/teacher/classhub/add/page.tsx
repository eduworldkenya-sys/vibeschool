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
      const memberships = await supabase.from('school_members').select('school_id').eq('profile_id', user.id).eq('role', 'teacher')
      if (cancelled) return
      if (memberships.error) setError('Your verified school access could not be loaded.')
      else if (!memberships.data?.length) setError('Your school must be verified before you add a class.')
      else {
        const schoolIds = Array.from(new Set(memberships.data.map(row => row.school_id).filter(Boolean)))
        const schoolRows = await supabase.from('schools').select('id,name').in('id', schoolIds).order('name')
        if (cancelled) return
        if (schoolRows.error) setError('Your school details could not be loaded.')
        else {
          const available = (schoolRows.data ?? []) as SchoolOption[]
          setSchools(available)
          setSchoolId(available[0]?.id ?? schoolIds[0] ?? '')
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
