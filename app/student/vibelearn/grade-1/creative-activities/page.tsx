import type { Metadata } from 'next'
import Grade1CreativeContentReader from '@/components/learn/Grade1CreativeContentReader'

export const metadata: Metadata = {
  title: 'Grade 1 Creative Activities | VibeLearn | VibeSchool',
  description: 'Read Grade 1 Creative Activities in VibeLearn using the canonical VibeSchool Originals reader.',
}

export default function GradeOneCreativeActivitiesVibeLearnPage() {
  return <Grade1CreativeContentReader />
}
