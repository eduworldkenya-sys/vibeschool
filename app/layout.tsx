import type { Metadata, Viewport } from 'next'
import { Jost, DM_Mono, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '600', '800'],
  display: 'block',
  variable: '--font-display',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400'],
  display: 'block',
  variable: '--font-mono',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  display: 'block',
  variable: '--font-serif',
})


const schemaOrg = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "VibeSchool",
  "url": "https://www.vibeschool.co.ke",
  "description": "Free CBC and Secondary school ebooks, past papers and exam materials for Kenyan students.",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "KE"
  },
  "areaServed": "Kenya",
  "educationalLevel": ["Primary", "Secondary", "CBC"],
  "availableLanguage": "English"
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  title: {
    default: 'VibeSchool — Free CBC & Secondary Ebooks, Past Papers Kenya',
    template: '%s | VibeSchool',
  },
  description: 'Free CBC and Secondary school ebooks, past papers and exam materials for Kenyan students. Curriculum-aligned study resources from Grade 1 to Form 4.',
  keywords: ['free CBC ebooks Kenya', 'KCSE past papers', 'KCPE past papers', 'CBC study materials', 'Kenya secondary school notes', 'free study materials Kenya'],
  openGraph: {
    title: 'VibeSchool — Free CBC & Secondary Ebooks Kenya',
    description: 'Free curriculum-aligned ebooks, past papers and exam materials for Kenyan students from Grade 1 to Form 4.',
    url: 'https://www.vibeschool.co.ke',
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
    images: [{
      url: 'https://www.vibeschool.co.ke/icons/icon-512.svg',
      width: 512,
      height: 512,
      alt: 'VibeSchool — Free CBC and Secondary Ebooks Kenya',
    }],
  },
  twitter: {
    card: 'summary',
    title: 'VibeSchool — Free CBC & Secondary Ebooks Kenya',
    description: 'Free curriculum-aligned ebooks, past papers and exam materials for Kenyan students from Grade 1 to Form 4.',
    images: ['https://www.vibeschool.co.ke/icons/icon-512.svg'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VibeSchool',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#05050F',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${jost.variable} ${dmMono.variable} ${cormorant.variable}`}
    >
      <body>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-VKBSGBYKKF" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-VKBSGBYKKF');
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
