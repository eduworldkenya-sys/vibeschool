import { Suspense } from 'react'
import { StoriesHub } from '@/components/originals/StoriesHub'

export const dynamic = 'force-dynamic'
export default function StoriesPage() {
  return <Suspense fallback={<main style={{padding:32}}>Opening VibeSchool Originals…</main>}><StoriesHub/></Suspense>
}
