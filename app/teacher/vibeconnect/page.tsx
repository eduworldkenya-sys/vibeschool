import { redirect } from 'next/navigation'

// This legacy route remains valid for bookmarks and deep links.
// All person-to-person communication now happens in the canonical VibeChat UI.
export default function LegacyTeacherVibeConnect() {
  redirect('/vibechat?tab=school')
}
