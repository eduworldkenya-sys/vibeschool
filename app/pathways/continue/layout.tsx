import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Save My Pathway | VibeSchool',
  robots: { index: false, follow: false },
}

export default function PathwayContinueLayout({ children }: { children: React.ReactNode }) {
  return children
}
