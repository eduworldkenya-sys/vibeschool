import type { Metadata } from 'next'
import UnifiedSuccessWishes from '@/components/success-wishes/UnifiedSuccessWishes'

export const metadata: Metadata = {
  title: 'Success Wishes | VibeSchool',
  description: 'Create a personal wish, choose the candidate’s school and use the private Success Wishes inbox.',
}

export default function SuccessWishesPage() {
  return <UnifiedSuccessWishes />
}
