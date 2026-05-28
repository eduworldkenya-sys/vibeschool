import { redirect } from 'next/navigation'

// TODO: Old landing page preserved in app/page.tsx.bak2
// Had role-picker UI + animated orbs — revisit for marketing page later
export default function RootPage() {
  redirect('/academy/signin')
}
