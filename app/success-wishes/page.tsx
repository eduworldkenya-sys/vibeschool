import type { Metadata } from 'next'
import SuccessCardStudio from '@/components/success-wishes/SuccessCardStudio'

export const metadata: Metadata = {
  title: 'Success Wishes — Personalised Exam Cards | VibeSchool',
  description: 'Create a beautiful, personalised success wishes card and share it as an image.',
}

export default function SuccessWishesPage() {
  return <SuccessCardStudio />
}
