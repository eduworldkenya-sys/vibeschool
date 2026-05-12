import type { Metadata } from 'next'
import { Jost, DM_Mono, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

const jost = Jost({ subsets: ['latin'], weight: ['300','400','600','800'], display: 'block', variable: '--loaded-jost' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400'], display: 'block', variable: '--loaded-dm-mono' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400'], style: ['italic'], display: 'block', variable: '--loaded-cormorant' })

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