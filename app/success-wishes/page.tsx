import type { Metadata } from 'next'
import SuccessWishes from '@/components/success-wishes/SuccessWishes'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Success Wishes',
  description: 'Send a candidate your encouragement. Open personal success wishes privately.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function SuccessWishesPage() {
  return <SuccessWishes />
}
