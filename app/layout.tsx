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
  name: 'Vibeschool',
  url: 'https://www.vibeschool.co.ke',
  description: 'A connected education platform for teaching, learning, practice and progress.',
  address: { '@type': 'PostalAddress', addressCountry: 'KE' },
  areaServed: 'Kenya',
  educationalLevel: ['Primary', 'Secondary', 'CBC'],
  availableLanguage: 'English',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  title: { default: 'Vibeschool — Teaching and learning, connected', template: '%s | Vibeschool' },
  description: 'Vibeschool connects curriculum, teaching, learning, practice and progress so teachers and learners can see what matters next.',
  keywords: ['Vibeschool', 'Kenya education', 'CBC learning', 'teacher tools Kenya', 'student learning Kenya', 'KCSE learning'],
  openGraph: {
    title: 'Vibeschool — Teaching and learning, connected',
    description: 'Learn. Teach. Know what comes next.',
    url: 'https://www.vibeschool.co.ke',
    siteName: 'Vibeschool',
    locale: 'en_KE',
    type: 'website',
    images: [{ url: '/icons/icon-512.svg', width: 512, height: 512, alt: 'Vibeschool' }],
  },
  twitter: {
    card: 'summary',
    title: 'Vibeschool — Teaching and learning, connected',
    description: 'Learn. Teach. Know what comes next.',
    images: ['/icons/icon-512.svg'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Vibeschool' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#05050F',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

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
