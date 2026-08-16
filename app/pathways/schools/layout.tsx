import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Senior Schools Kenya | VibeSchool Pathways',
  description: 'Search VibeSchool’s canonical Kenyan senior-school directory and, where verified, pathway and subject-combination offerings.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/pathways/schools' },
  openGraph: {
    title: 'Find Senior Schools | VibeSchool Pathways',
    description: 'Search canonical Kenyan schools and verified pathway offerings.',
    url: 'https://www.vibeschool.co.ke/pathways/schools',
    siteName: 'VibeSchool',
    type: 'website',
  },
}

export default function PathwaySchoolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
