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
  const [switchingSchool, setSwitchingSchool] = useState(false)
  const [leavingSchool, setLeavingSchool] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const timeout = window.setTimeout(() => {
        if (!cancelled) {
          setError('Class setup is taking too long to load. Please retry or enter Teacher OS and add a class later.')
          setLoading(false)
        }
      }, 12000)
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (cancelled) return
        if (authError || !user) { router.replace('/academy/signin?role=teacher'); return }

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

        const [{ data: context, error: contextError }, result] = await Promise.all([
          supabase.rpc('get_my_teacher_school_context'),
          supabase.from('schools').select('id,name').in('id', ids).order('name'),
        ])
        if (cancelled) return
        if (contextError || result.error) setError('Your school details could not be loaded.')
        else {
          const rows = (result.data ?? []) as SchoolOption[]
          setSchools(rows)
          const active = (context as { active_school_id?: string | null } | null)?.active_school_id
          setSchoolId((active && ids.includes(active) ? active : null) ?? rows[0]?.id ?? ids[0] ?? '')
        }
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Class setup could not be loaded. You can retry or enter Teacher OS and add a class later.')
          setLoading(false)
        }
      } finally {
        window.clearTimeout(timeout)
      }
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
        {loading && <div aria-live="polite" aria-busy="true" style={{ minHeight: 120, padding: 20, borderRadius: 16, background: '#f3f4f6', color: C.textMuted, textAlign: 'center' }}>Loading your class setup…</div>}
        {!loading && error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: C.error }}>{error}<button type="button" onClick={() => window.location.reload()} style={{ display: 'block', marginTop: 10, padding: 10, borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 800 }}>Retry</button></div>}
        {!loading && !error && schools.length > 1 && (
          <label style={{ display: 'block', marginBottom: 16, color: C.textMuted, fontSize: 12, fontWeight: 800 }}>School
            <select value={schoolId} disabled={switchingSchool} onChange={async event => {
              const previous = schoolId
              const next = event.target.value
              setSwitchingSchool(true); setError('')
              const { error: switchError } = await supabase.rpc('set_my_active_teacher_school', { p_school_id: next })
              if (switchError) { setSchoolId(previous); setError('We could not switch the active school safely. Your previous school is still active.') }
              else setSchoolId(next)
              setSwitchingSchool(false)
            }} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff' }}>
              {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
        )}
        {!loading && !error && schoolId && !switchingSchool && <TeacherClassForm schoolId={schoolId} mode="onboarding" />}
        {!loading && !error && schoolId && (
          <button type="button" disabled={leavingSchool || switchingSchool} onClick={async () => {
            if (!window.confirm('Selected the wrong school? Remove this school connection and choose again. Existing class assignments cannot be removed this way.')) return
            setLeavingSchool(true); setError('')
            const { error: leaveError } = await supabase.rpc('leave_my_teacher_school', { p_school_id: schoolId })
            setLeavingSchool(false)
            if (leaveError) {
              setError(leaveError.message?.includes('school_has_teacher_assignments') ? 'This school already has your class assignments. Remove or transfer those assignments before leaving the school.' : 'We could not safely remove this school connection. Nothing was changed.')
              return
            }
            router.replace('/teacher/onboarding/school?change=1')
          }} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 11, border: `1px solid ${C.border}`, background: '#fff', color: C.error, fontWeight: 800 }}>
            {leavingSchool ? 'Removing school…' : 'Wrong school? Change school'}
          </button>
        )}
        <button type="button" onClick={() => router.push('/teacher/pulse')} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 11, border: `1px solid ${C.border}`, background: '#fff', color: C.textMuted, fontWeight: 800 }}>Skip — go to Teacher OS</button>
      </section>
    </main>
  )
}
