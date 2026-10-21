import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TextTestClient from './TextTestClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Success Wishes · Synthetic text test',
  description: 'Browser-only synthetic text wish walkthrough. No messages are delivered.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// This must NEVER be reachable from the production VibeSchool deployment.
// A specific branch-scoped Vercel Preview flag commissions this test page only.
export default function TextTestPage() {
  if (process.env.SUCCESS_WISHES_TEXT_TEST_ENABLED !== 'true' ||
      (process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV !== 'development')) {
    notFound()
  }
  return <TextTestClient />
}
