import { redirect } from 'next/navigation'

// Merged into /vibetutor/browse. Kept so old links keep working.
export default function FindTutorRedirect() {
  redirect('/vibetutor/browse')
}
