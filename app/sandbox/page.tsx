import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicProductSandbox } from '@/components/public/PublicProductSandbox'

export const metadata: Metadata = {
  alternates: { canonical: '/sandbox' },
  title: 'VibeSchool Live Sandbox — Plan → Teach → Evidence → Next Action',
  description: 'Use a safe, no-login VibeSchool demonstration to follow one learning journey from curriculum planning through teaching evidence, assessment, understanding and the next action.',
}

export default function SandboxPage() {
  return <div>
    <PublicHeader product="Live Sandbox" />
    <main id="main-content">
      <PublicProductSandbox />
    </main>
    <PublicFooter />
  </div>
}
