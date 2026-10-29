import type { Metadata } from 'next'

const title = 'Success Wishes 2026 — Open Your Card'
const description = 'Open your personalised Success Card.'
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
    images: [{ url: image, width: 1200, height: 630, alt: 'Success Wishes 2026 personalised card' }],
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
