'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TeacherClassForm from '@/components/teacher/TeacherClassForm'
import { C } from '@/components/teacher/ui'

type SchoolOption = { id: string; name: string }

export default function ClassOnboardingPage() {
  const router = useRouter()
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/academy/signin?role=teacher'); return }

      const memberships = await supabase.from('school_members').select('school_id').eq('profile_id', user.id).eq('role', 'teacher')
      if (cancelled) return
      if (memberships.error) {
        setError('Your verified school access could not be loaded.')
        setLoading(false)
        return
      }
      const ids = Array.from(new Set((memberships.data ?? []).map(row => row.school_id).filter(Boolean)))
      if (!ids.length) {
        router.replace('/teacher/onboarding/school')
        return
      }

      const result = await supabase.from('schools').select('id,name').in('id', ids).order('name')
      if (cancelled) return
      if (result.error) setError('Your school details could not be loaded.')
      else {
        const rows = (result.data ?? []) as SchoolOption[]
        setSchools(rows)
        setSchoolId(rows[0]?.id ?? ids[0] ?? '')
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  return (
    <main style={{ minHeight: '100vh', background: '#f0f2f5', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 460, margin: '32px auto', background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.dark }}>Add your first class</div>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>Optional. You can enter Teacher OS now and add classes later from My Classes.</p>
        </div>

        {loading && <div aria-busy="true" style={{ height: 280, borderRadius: 16, background: '#f3f4f6' }} />}
        {!loading && error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: C.error }}>{error}</div>}
        {!loading && schools.length > 1 && (
          <label style={{ display: 'block', marginBottom: 16, color: C.textMuted, fontSize: 12, fontWeight: 800 }}>School
            <select value={schoolId} onChange={event => setSchoolId(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff' }}>
              {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
        )}
        {!loading && !error && schoolId && <TeacherClassForm schoolId={schoolId} mode="onboarding" />}
        {!loading && (
          <button type="button" onClick={() => router.push('/teacher/pulse')} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 11, border: `1px solid ${C.border}`, background: '#fff', color: C.textMuted, fontWeight: 800 }}>Skip — go to Teacher OS</button>
        )}
      </section>
    </main>
  )
}
