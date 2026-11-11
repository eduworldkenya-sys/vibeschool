import type { Metadata } from 'next'
import Grade1CreativeContentReader from '@/components/learn/Grade1CreativeContentReader'

export const metadata: Metadata = {
  title: 'Grade 1 Creative Activities | VibeSchool',
  description: 'Read original Grade 1 Creative Activities learning activities and curriculum guidance in VibeSchool. No PDF required.',
  alternates: { canonical: '/learn/grade-1/creative-activities' },
}

export default function Grade1CreativeActivitiesContentPage() {
  return <Grade1CreativeContentReader />
}
