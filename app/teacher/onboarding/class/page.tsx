'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TeacherClassForm from '@/components/teacher/TeacherClassForm'
import { C } from '@/components/teacher/ui'

type SchoolOption = { id: string; name: string }
type TeacherSchoolContext = {
  state?: 'unauthenticated' | 'needs_school' | 'ready'
  active_school_id?: string | null
  schools?: Array<{ id: string; name: string }>
}

const LOAD_TIMEOUT_MS = 12000

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('teacher_class_setup_timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default function ClassOnboardingPage() {
  const router = useRouter()
  const requestId = useRef(0)
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [switchingSchool, setSwitchingSchool] = useState(false)
  const [leavingSchool, setLeavingSchool] = useState(false)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const auth = await withTimeout(supabase.auth.getUser(), LOAD_TIMEOUT_MS)
      if (currentRequest !== requestId.current) return
      const { data: { user }, error: authError } = auth
      if (authError || !user) {
        router.replace('/academy/signin?role=teacher')
        return
      }

      const controller = new AbortController()
      const rpcTimeout = window.setTimeout(() => controller.abort('teacher_class_setup_timeout'), LOAD_TIMEOUT_MS)
      const { data: contextData, error: contextError } = await supabase
        .rpc('get_my_teacher_school_context')
        .abortSignal(controller.signal)
      window.clearTimeout(rpcTimeout)
      if (currentRequest !== requestId.current) return
      if (contextError) {
        if (controller.signal.aborted) throw new Error('teacher_class_setup_timeout')
        throw contextError
      }

      const context = contextData as TeacherSchoolContext | null
      if (!context || context.state === 'unauthenticated') {
        router.replace('/academy/signin?role=teacher')
        return
      }
      const rows = (context.schools ?? []).filter((school): school is SchoolOption => Boolean(school?.id && school?.name))
      if (context.state === 'needs_school' || !context.active_school_id || rows.length === 0) {
        router.replace('/teacher/onboarding/school')
        return
      }
      if (!rows.some(school => school.id === context.active_school_id)) {
        throw new Error('active_school_not_authorized')
      }

      setSchools(rows)
      setSchoolId(context.active_school_id)
    } catch (loadError) {
      if (currentRequest !== requestId.current) return
      const timedOut = loadError instanceof Error && loadError.message === 'teacher_class_setup_timeout'
      setError(timedOut
        ? 'Class setup is taking too long to load. Retry, or enter Teacher OS and add a class later.'
        : 'Your verified school access could not be loaded. Retry, or enter Teacher OS and add a class later.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
    return () => { requestId.current += 1 }
  }, [load])

  return (
    <section style={{ minHeight: '100vh', background: '#f0f2f5', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 460, margin: '32px auto', background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 750, color: C.dark }}>Add your first class</div>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>Optional. You can enter Teacher OS now and add classes later from My Classes.</p>
        </div>
        {loading && <div role="status" aria-live="polite" aria-busy="true" style={{ minHeight: 120, padding: 20, borderRadius: 16, background: '#f3f4f6', color: C.textMuted, textAlign: 'center' }}>Loading your class setup…</div>}
        {!loading && error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: C.error }}>{error}<button type="button" onClick={() => void load()} style={{ display: 'block', marginTop: 10, padding: 10, borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 800 }}>Retry</button></div>}
        {!loading && !error && schools.length > 1 && (
          <label style={{ display: 'block', marginBottom: 16, color: C.textMuted, fontSize: 12, fontWeight: 800 }}>School
            <select value={schoolId} disabled={switchingSchool} onChange={async event => {
              const previous = schoolId
              const next = event.target.value
              setSwitchingSchool(true); setError('')
              const { error: switchError } = await supabase.rpc('set_my_active_teacher_school', { p_school_id: next })
              if (switchError) { setSchoolId(previous); setError('We could not switch the active school safely. Your previous school is still active.') }
              else { setSchoolId(next); await load() }
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
        <button type="button" onClick={() => router.replace('/teacher/pulse')} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 11, border: `1px solid ${C.border}`, background: '#fff', color: C.textMuted, fontWeight: 800 }}>Skip — go to Teacher OS</button>
      </section>
    </section>
  )
}
