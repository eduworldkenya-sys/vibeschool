import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibeCoin Studio — VibeSchool Originals',
  description: 'Create cinematic branded coin toss videos with customizable teams, live stages and fair 50/50 results.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
