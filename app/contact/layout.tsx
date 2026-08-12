import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact VibeSchool | Support & Help',
  description:
    'Contact VibeSchool for account help, school access, technical problems, privacy questions and other support. Tell us what happened and we will investigate with context.',
  openGraph: {
    title: 'Contact VibeSchool | Support & Help',
    description:
      'Need help with VibeSchool? Tell us what happened and get a support request connected to your account.',
    url: 'https://www.vibeschool.co.ke/contact',
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Contact VibeSchool | Support & Help',
    description:
      'Need help with VibeSchool? Tell us what happened and get a support request connected to your account.',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
