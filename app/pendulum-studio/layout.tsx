import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibePendulum Studio — VibeSchool Originals',
  description: 'Unlisted creator tool for cinematic two-outcome pendulum videos.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function PendulumStudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
