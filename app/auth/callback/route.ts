import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { continuationForRole, normalizeContinuation, ROLE_HOME } from '@/lib/auth/continuation'

const FIRST_ACCESS: Record<string, string> = {
  teacher: '/teacher/onboarding/school',
  parent: '/parent/students',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function safeRequestedRole(value: string | null): string | null {
  return value && Object.prototype.hasOwnProperty.call(ROLE_HOME, value) ? value : null
}

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.url))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const requestedNext = normalizeContinuation(searchParams.get('next'))
  const requestedRole = safeRequestedRole(searchParams.get('role'))
  const pendingCookies: PendingCookie[] = []

  if (!code) return redirectWithCookies(req, '/login?oauth_error=missing_code', pendingCookies)

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: PendingCookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options })
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return redirectWithCookies(req, '/login?oauth_error=exchange_failed', pendingCookies)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirectWithCookies(req, '/login?oauth_error=user_missing', pendingCookies)

  const { data: onboarding, error: onboardingErr } = await supabase.rpc('get_my_onboarding_state')
  if (!onboardingErr && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
    const state = typeof onboarding.state === 'string' ? onboarding.state : null
    const destination = typeof onboarding.destination === 'string' ? onboarding.destination : null
    const role = typeof onboarding.role === 'string' ? onboarding.role : null

    if (destination && state && state !== 'unknown_role') {
      const continuation = state === 'ready' ? continuationForRole(requestedNext, role) : null
      return redirectWithCookies(req, continuation || destination, pendingCookies)
    }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role && ROLE_HOME[profile.role]) {
    const continuation = continuationForRole(requestedNext, profile.role)
    return redirectWithCookies(req, continuation || ROLE_HOME[profile.role], pendingCookies)
  }

  // A brand-new OAuth identity has no application authority yet. Requested role
  // selects only the bounded first-access onboarding route; it never creates role.
  const destination = requestedRole ? FIRST_ACCESS[requestedRole] : '/'
  return redirectWithCookies(req, destination, pendingCookies)
}
