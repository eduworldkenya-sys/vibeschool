import type { Metadata } from 'next'
import UnifiedSuccessWishes from '@/components/success-wishes/UnifiedSuccessWishes'

export const metadata: Metadata = {
  title: 'Success Wishes | VibeSchool',
  description: 'Choose a Success Wishes design and version, personalise a wish, and preview it before checkout.',
}

export default function SuccessWishesPage() {
  return <UnifiedSuccessWishes testMode={process.env.NODE_ENV === 'development' && process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE === '1'} />
}
