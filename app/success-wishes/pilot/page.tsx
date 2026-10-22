import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function GilgilSuccessWishesPilot() {
  // The browser-only Gilgil journey is retained solely for local synthetic QA.
  // Production and ordinary previews have one canonical Success Wishes page.
  if (process.env.NODE_ENV !== 'development' || process.env.SUCCESS_WISHES_LOCAL_PILOT_TEST !== 'true') {
    redirect('/success-wishes')
  }
  const { default: PilotJourney } = await import('@/components/success-wishes/PilotJourney')
  return <PilotJourney />
}
