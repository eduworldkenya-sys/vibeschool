import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Student Learning — Free CBC & Secondary Resources',
  description: 'Free CBC and Secondary school study materials, past papers, ebooks and exam resources for Kenyan students from Grade 1 to Form 4.',
  openGraph: {
    title: 'Student Learning — Free CBC & Secondary Resources',
    description: 'Free CBC and Secondary school study materials, past papers, ebooks and exam resources for Kenyan students from Grade 1 to Form 4.',
    url: 'https://www.vibeschool.co.ke/student/learn',
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
  },
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
