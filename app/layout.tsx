import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'VibeSchool',
  description: 'Built around the teacher.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${dmMono.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  )
}