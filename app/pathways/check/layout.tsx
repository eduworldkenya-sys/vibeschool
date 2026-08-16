import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Pathway Check Kenya | VibeSchool',
  description: 'Take a short free pathway check and get an early indication of which Kenyan senior-school pathway direction may be worth exploring. No login required.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways/check' },
  openGraph: {
    title: 'Free Pathway Check | VibeSchool Pathways',
    description: 'Six short questions. Early pathway guidance. No login required.',
    url: 'https://www.vibeschool.co.ke/pathways/check',
    siteName: 'VibeSchool',
    type: 'website',
  },
}

export default function QuickCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
