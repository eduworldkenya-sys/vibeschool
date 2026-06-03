import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibeGlobal — Free Kenyan Educational Content',
  description: 'Discover free CBC and Secondary school ebooks, past papers, stories and study materials created by Kenyan educators.',
  openGraph: {
    title: 'VibeGlobal — Free Kenyan Educational Content',
    description: 'Discover free CBC and Secondary school ebooks, past papers, stories and study materials created by Kenyan educators.',
    url: 'https://www.vibeschool.co.ke/global',
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
  },
}

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
