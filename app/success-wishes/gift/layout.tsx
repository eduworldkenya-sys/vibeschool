import type { Metadata } from 'next'

const title = 'You Received a Success Card | Success Wishes 2026'
const description = 'Someone sent you a Success Card. A special message is waiting for you. Tap to open your surprise.'
const url = 'https://vibeschool.co.ke/success-wishes/gift'
const image = 'https://vibeschool.co.ke/success-wishes/gift/opengraph-image'

// This preview is intentionally generic: private gift tokens and personal messages must not appear in metadata.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title,
    description,
    url,
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
    images: [{ url: image, width: 1200, height: 630, alt: 'A private Success Card is waiting for you' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  },
}

export default function PrivateGiftLayout({ children }: { children: React.ReactNode }) {
  return children
}
