import type { Metadata } from 'next'
import PilotJourney from '@/components/success-wishes/PilotJourney'

export const metadata: Metadata = {
  title: 'Gilgil Township Success Wishes Pilot | VibeSchool',
  description: 'A browser-isolated test of digital greeting cards using a fictional candidate. No live school delivery.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function GilgilSuccessWishesPilot() {
  return <PilotJourney />
}
