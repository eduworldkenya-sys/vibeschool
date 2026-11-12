'use client'

import { useParams } from 'next/navigation'
import Grade4TimeOutcomePackage from '@/components/learn/Grade4TimeOutcomePackage'

// Both independent and class-linked learners use the same published read RPC.
export default function Grade4TimeOutcomePage() {
  const params = useParams()
  const outcomeId = typeof params.outcomeId === 'string' ? params.outcomeId : ''
  return <Grade4TimeOutcomePackage key={outcomeId} audience="learner" initialOutcomeId={outcomeId} />
}
