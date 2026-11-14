import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Games Studio — VibeSchool Originals',
  description: 'Unlisted promotional games trial and creator stage.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function GamesStudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
