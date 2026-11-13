import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Spin Studio — VibeSchool Creator Tool',
  description: 'Unlisted creator tool for producing interactive VibeSchool wheel videos.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function SpinStudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
