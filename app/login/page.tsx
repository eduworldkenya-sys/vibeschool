import { redirect } from 'next/navigation'
import { requiredRoleForPath, safeInternalPath } from '@/lib/auth-routing'

// An unauthenticated learner deep link must open learner login, never the
// teacher form. The generic entry still defaults to teacher when no protected
// destination provides a more specific role.
export default function LoginPage({ searchParams }: { searchParams: { redirect?: string; next?: string } }) {
  const destination = safeInternalPath(searchParams.redirect ?? searchParams.next)
  const requiredRole = destination ? requiredRoleForPath(destination) : null
  const role = requiredRole === 'student' || requiredRole === 'parent' ? requiredRole : 'teacher'
  redirect(destination ? `/login/${role}?redirect=${encodeURIComponent(destination)}` : `/login/${role}`)
}
