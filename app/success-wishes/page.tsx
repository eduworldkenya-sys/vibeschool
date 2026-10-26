import type { Metadata } from 'next'
import SuccessCardStudio from '@/components/success-wishes/SuccessCardStudio'

export const metadata: Metadata = {
  title: 'Success Wishes | VibeSchool',
  description: 'Choose a Success Wishes design and version, personalise a wish, and preview it before checkout.',
}

export default function SuccessWishesPage() {
  return <SuccessCardStudio testMode={process.env.NODE_ENV === 'development' && process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE === '1'} />
}
