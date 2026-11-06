import { redirect } from 'next/navigation'
import { safeInternalPath } from '@/lib/auth-routing'

// The canonical sign-in form lives at /login/teacher. The generic login URL
// should open that existing form rather than showing an extra role chooser.
// Preserve a validated destination for links into protected workspaces.
export default function LoginPage({ searchParams }: { searchParams: { redirect?: string; next?: string } }) {
  const destination = safeInternalPath(searchParams.redirect ?? searchParams.next)
  redirect(destination ? `/login/teacher?redirect=${encodeURIComponent(destination)}` : '/login/teacher')
}
