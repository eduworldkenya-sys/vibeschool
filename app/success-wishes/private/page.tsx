import type { Metadata } from 'next'
import SuccessWishes from '@/components/success-wishes/SuccessWishes'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Private Success Wishes | VibeSchool',
  description: 'Private candidate inbox and sender information. Public message delivery is not yet active.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function PrivateSuccessWishesPage() {
  return <SuccessWishes />
}
