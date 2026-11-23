import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MiniExplore } from '@/components/public/MiniExplore'

export const metadata: Metadata = {
  alternates: { canonical: '/explore' },
  title: 'Explore Mini Lessons | VibeSchool',
  description: 'Explore short, illustrated Mini Lessons across History, Agriculture, Physics and Literature. Discover useful knowledge and the educators behind it.',
  robots: { index: false, follow: true },
}

export default function ExplorePage() {
  return <div>
    <PublicHeader product="Explore" />
    <main id="main-content" tabIndex={-1}>
      <Suspense fallback={<p style={{ padding: 32 }}>Opening Explore…</p>}>
        <MiniExplore />
      </Suspense>
    </main>
    <PublicFooter />
  </div>
}
