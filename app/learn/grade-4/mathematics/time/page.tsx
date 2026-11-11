import type { Metadata } from 'next'
import Grade4TimeContentReader from '@/components/learn/Grade4TimeContentReader'

export const metadata: Metadata = {
  title: 'Grade 4 Mathematics: Time',
  description: 'VibeSchool Originals: clocks, a.m. and p.m., converting time and duration in Grade 4 Mathematics.',
  alternates: { canonical: '/learn/grade-4/mathematics/time' },
}

export default function Grade4TimePage() {
  return <Grade4TimeContentReader />
}
