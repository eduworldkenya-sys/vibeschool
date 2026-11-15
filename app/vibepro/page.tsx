import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/**
 * VibePro is currently a self-contained, fictional-data business suite preview.
 * Keep it outside the learner, teacher and Supabase finance boundaries until
 * a separately governed production accounting service is available.
 */
export const metadata: Metadata = {
  title: 'VibePro — Business Suite Preview',
  description: 'Explore the VibePro business management and accounting demonstration with fictional company data.',
  robots: { index: false, follow: false },
}

export default function VibeProPreviewPage() {
  redirect('/vibepro/demo.html')
}
