import { redirect } from 'next/navigation'

// The creator games now live on the standalone unlisted website route.
export default function LegacyHQGamesRedirect() {
  redirect('/games-studio')
}
