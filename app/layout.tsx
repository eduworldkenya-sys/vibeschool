import type { Metadata, Viewport } from 'next'
import { Jost, DM_Mono, Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import LearnYourWayReaderBridge from '@/components/student/LearnYourWayReaderBridge'
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt'
import PwaServiceWorker from '@/components/pwa/PwaServiceWorker'
import './globals.css'

const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '600', '800'], display: 'block', variable: '--font-display' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400'], display: 'block', variable: '--font-mono' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400'], style: ['italic'], display: 'block', variable: '--font-serif' })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-jakarta' })

const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'VibeSchool',
  url: 'https://www.vibeschool.co.ke',
  logo: 'https://www.vibeschool.co.ke/icons/vibeschool-logo.png',
  description: 'VibeSchool connects curriculum, teaching, learning evidence and the people supporting a learner — with learning resources and experiences for learners, teachers, parents and schools.',
  address: { '@type': 'PostalAddress', addressCountry: 'KE' },
  areaServed: 'Kenya',
  educationalLevel: ['Primary', 'Secondary', 'CBC'],
  availableLanguage: 'English',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  title: { default: 'VibeSchool — Free CBC & Secondary Ebooks, Past Papers Kenya', template: '%s | VibeSchool' },
  description: 'Free CBC and Secondary school ebooks, past papers and exam materials for Kenyan students. Curriculum-aligned study resources from Grade 1 to Form 4.',
  keywords: ['free CBC ebooks Kenya', 'KCSE past papers', 'KCPE past papers', 'CBC study materials', 'Kenya secondary school notes', 'free study materials Kenya'],
  alternates: { canonical: 'https://www.vibeschool.co.ke' },
  openGraph: {
    title: 'VibeSchool — Learning, teaching and education, connected',
    description: 'VibeSchool connects learning resources, curriculum, teaching, evidence and the people supporting a learner.',
    url: 'https://www.vibeschool.co.ke', siteName: 'VibeSchool', locale: 'en_KE', type: 'website',
    images: [{ url: '/icons/vibeschool-logo.png', alt: 'VibeSchool' }],
  },
  twitter: {
    card: 'summary',
    title: 'VibeSchool — Learning, teaching and education, connected',
    description: 'A connected education experience for learners, teachers, parents and schools, with curriculum-aligned learning resources.',
    images: ['/icons/vibeschool-logo.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VibeSchool' },
  icons: {
    icon: [
      { url: '/pwa-icons/v2/192', type: 'image/png', sizes: '192x192' },
      { url: '/icons/vibeschool-logo.png', type: 'image/png' },
    ],
    shortcut: [{ url: '/pwa-icons/v2/192', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { themeColor: '#070B1F', width: 'device-width', initialScale: 1, minimumScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${dmMono.variable} ${cormorant.variable} ${plusJakarta.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />
        {children}
        <LearnYourWayReaderBridge />
        <PwaServiceWorker />
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
