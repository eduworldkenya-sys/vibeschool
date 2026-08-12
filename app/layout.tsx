import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Jost, DM_Mono, Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import LearnYourWayReaderBridge from '@/components/student/LearnYourWayReaderBridge'
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
  description: 'VibeSchool is an Education Operating System connecting curriculum, teaching, learning, evidence, people and decisions around the learner.',
  address: { '@type': 'PostalAddress', addressCountry: 'KE' },
  areaServed: 'Kenya',
  educationalLevel: ['Primary', 'Secondary', 'CBC'],
  availableLanguage: 'English',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  title: { default: 'VibeSchool — Education Operating System for Learning & Teaching', template: '%s | VibeSchool' },
  description: 'VibeSchool connects curriculum, teaching, learning, evidence, people and decisions into one trusted learning journey for learners, teachers, parents and schools.',
  keywords: ['VibeSchool', 'Education Operating System Kenya', 'CBC learning Kenya', 'Kenya curriculum learning resources', 'teacher resources Kenya', 'student learning Kenya', 'school education platform Kenya'],
  openGraph: {
    title: 'VibeSchool — Education Operating System for Learning & Teaching',
    description: 'A connected education system for learners, teachers, parents and schools, grounded in curriculum and evidence.',
    url: 'https://www.vibeschool.co.ke', siteName: 'VibeSchool', locale: 'en_KE', type: 'website',
    images: [{ url: 'https://www.vibeschool.co.ke/icons/icon-512.svg', width: 512, height: 512, alt: 'VibeSchool' }],
  },
  twitter: { card: 'summary', title: 'VibeSchool — Education Operating System for Learning & Teaching', description: 'A connected education system for learners, teachers, parents and schools.', images: ['https://www.vibeschool.co.ke/icons/icon-512.svg'] },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VibeSchool' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { themeColor: '#05050F', width: 'device-width', initialScale: 1, minimumScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${dmMono.variable} ${cormorant.variable} ${plusJakarta.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />
        {children}
        <LearnYourWayReaderBridge />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
            })
          }
        ` }} />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VKBSGBYKKF" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-VKBSGBYKKF');
          `}
        </Script>
      </body>
    </html>
  )
}
