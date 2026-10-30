import type { Metadata } from 'next'
import SuccessCardStudio from '@/components/success-wishes/SuccessCardStudio'
import SuccessWishesFloatingOffer from '@/components/success-wishes/SuccessWishesFloatingOffer'

const title = 'Success Wishes 2026 | VibeSchool'
const description = 'Wish students good luck & success. Create a personalised Digital Success Card free with campaign code DNJIMAX3.'
const url = 'https://vibeschool.co.ke/success-wishes'
const image = 'https://vibeschool.co.ke/success-wishes/opengraph-image'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: url },
  openGraph: {
    title,
    description,
    url,
    siteName: 'VibeSchool',
    locale: 'en_KE',
    type: 'website',
    images: [{ url: image, width: 1200, height: 630, alt: 'Success Wishes 2026 — personalised Success Cards by VibeSchool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  },
}

export default function SuccessWishesPage({ searchParams }: { searchParams?: { offerPreview?: string } }) {
  const previewOffer = searchParams?.offerPreview === '1'
  return <>
    <SuccessCardStudio testMode={process.env.NODE_ENV === 'development' && process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE === '1'} />
    <SuccessWishesFloatingOffer preview={previewOffer} />
  </>
}
