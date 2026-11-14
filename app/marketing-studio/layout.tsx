import type { Metadata } from 'next'

export const metadata: Metadata = {
 title: 'Marketing Studio — VibeSchool Originals',
 description: 'Unlisted unified game creator hub for VibeSpin, VibeSphere, VibeCoin and VibeGames.',
 robots: {index:false,follow:false,googleBot:{index:false,follow:false}},
}

export default function MarketingStudioLayout({children}:{children:React.ReactNode}) {return children}
