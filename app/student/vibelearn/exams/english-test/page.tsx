'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listMyAssessmentAssignments } from '@/lib/assessment/discovery'

/** Legacy pilot URL: resolve the learner's authorized canonical assignment, never serve local answer keys. */
export default function Grade4EnglishEntry() {
  const router = useRouter()
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    listMyAssessmentAssignments()
      .then(assignments => {
        if (cancelled) return
        const english = assignments.find(item => /^Grade 4 English — Pilot 01$/i.test(item.title))
        if (!english) { setError('The English pilot has not been assigned to your learner account.'); return }
        router.replace(`/student/assessment/${english.assignmentId}`)
      })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load the English assessment.') })
    return () => { cancelled = true }
  }, [router])
  return <main style={{maxWidth:480,margin:'48px auto',padding:24,fontFamily:'system-ui,sans-serif'}}>
    <h1 style={{fontSize:24}}>Grade 4 English</h1>
    {error ? <><p role="alert">{error}</p><Link href="/student/vibelearn/exams">Back to Exams</Link></> : <p role="status">Opening your assigned English assessment…</p>}
  </main>
}
