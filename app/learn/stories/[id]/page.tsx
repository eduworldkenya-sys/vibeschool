import { Suspense } from 'react'
import { StoryBook } from '@/components/originals/StoryBook'

export const dynamic = 'force-dynamic'
export default function StoryLandingPage() {
  return <Suspense fallback={<main style={{padding:32}}>Opening story…</main>}><StoryBook mode="detail"/></Suspense>
}
