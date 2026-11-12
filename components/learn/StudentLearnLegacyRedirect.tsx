'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { SCHOOL_LEVELS, recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'

/**
 * Legacy VibeLearn index/reading links converge on Learn.
 * This is a navigation adapter only: exams, assignments, textbooks, revision
 * and grade-specific nested routes remain on their original protected engines.
 */
export default function StudentLearnLegacyRedirect() {
  const { identity, loading } = useStudent()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    const prior = new URLSearchParams(window.location.search)
    const requested = prior.get('grade')
    const recognised = recogniseLearnerGrade(identity?.className)
    const allowed: ReadonlySet<string> = new Set<string>(SCHOOL_LEVELS.flatMap(level => [...level.grades]))
    const grade = requested && allowed.has(requested) ? requested : recognised
    const next = new URLSearchParams()
    if (grade) next.set('grade', grade)
    const subject = prior.get('subject')
    if (subject && subject.length <= 120) next.set('subject', subject)
    const view = prior.get('view')
    if (view === 'reading' || view === 'courses') next.set('view', view)
    router.replace('/learn' + (next.size ? '?' + next.toString() : ''))
  }, [loading, identity?.className, router])
  return <main role="status" style={{ minHeight:'55vh', display:'grid', placeItems:'center', padding:24, background:'#f5f8f6', color:'#24563e' }}>
    Opening your learning library…
  </main>
}
