import type { Metadata } from 'next'
import { PublicProductSandbox } from '@/components/public/PublicProductSandbox'

export const metadata: Metadata = {
  alternates: { canonical: '/sandbox' },
  title: 'VibeSchool Experience | One Lesson. Everything Connected.',
  description: 'Explore one Grade 8 Mathematics example. Read, answer a question and see an immediate evidence-based next step in a public interactive demonstration.',
}

export default function SandboxPage() {
  return <PublicProductSandbox />
}
