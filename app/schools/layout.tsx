import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kenya School Directory | VibeSchool',
  description: 'Find Kenyan schools by name and location, view canonical school profiles, and submit missing or corrected school information for verification.',
  alternates: { canonical: '/schools' },
  openGraph: {
    title: 'Kenya School Directory | VibeSchool',
    description: 'Search schools, inspect verified information, and help VibeSchool improve missing school records.',
    url: '/schools',
    type: 'website',
  },
}

export default function SchoolsLayout({children}:{children:React.ReactNode}){
  return children
}
