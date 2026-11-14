import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibeSphere Studio — VibeSchool Originals',
  description: 'Unlisted creator tool for cinematic two-outcome spinning-sphere videos.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function PendulumStudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
