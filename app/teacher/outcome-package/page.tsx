'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Grade4TimeOutcomePackage from '@/components/learn/Grade4TimeOutcomePackage'

export const dynamic = 'force-dynamic'

// Teacher preparation requires only a verified outcome and a released version.
// Timetable occurrences and class assignments belong to scheduled teaching.
function PageContent() {
  const search = useSearchParams()
  return <Grade4TimeOutcomePackage key={search.get('outcomeId') ?? 'catalogue'}
    audience="teacher" initialOutcomeId={search.get('outcomeId')} />
}

export default function TeacherOutcomePackagePage() {
  return <Suspense fallback={<p role="status">Opening outcome resources…</p>}><PageContent /></Suspense>
}
