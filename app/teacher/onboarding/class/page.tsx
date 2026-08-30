'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TeacherClassForm from '@/components/teacher/TeacherClassForm'
import { C } from '@/components/teacher/ui'

export default function ClassOnboardingPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function resolveSchool() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const { data: membership } = await supabase.from('school_members').select('school_id').eq('profile_id', user.id).eq('role', 'teacher').limit(1).maybeSingle()
      if (cancelled) return
      if (!membership?.school_id) { router.replace('/teacher/onboarding/school'); return }
      setSchoolId(membership.school_id)
      setLoading(false)
    }
    void resolveSchool()
    return () => { cancelled = true }
  }, [router])

  if (loading) return <div aria-busy="true" style={{ minHeight: 320, background: '#f3f4f6' }} />

  return (
    <main style={{ minHeight: '100vh', background: '#f0f2f5', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, padding: 26, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <header style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 24 }} aria-hidden="true">📚</div>
          <h1 style={{ margin: '8px 0 4px', color: C.dark, fontSize: 22 }}>Your first class</h1>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>Step 2 of 3 · PP1 to Grade 12 and Form 1 to Form 4</p>
        </header>
        <TeacherClassForm schoolId={schoolId} mode="onboarding" />
        <button type="button" onClick={() => router.push('/teacher')} style={{ width: '100%', marginTop: 10, padding: 12, border: `1px solid ${C.border}`, borderRadius: 11, background: '#fff', color: C.textMuted, fontWeight: 750 }}>Skip for now</button>
      </section>
    </main>
  )
}
