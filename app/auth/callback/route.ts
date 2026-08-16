import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AUTH_DASHBOARDS, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

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
  return value && Object.prototype.hasOwnProperty.call(AUTH_DASHBOARDS, value)
    ? value
    : null
}

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.url))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'))
  const requestedRole = safeRequestedRole(searchParams.get('role'))
  const intent = searchParams.get('intent') === 'signup' ? 'signup' : 'signin'
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return redirectWithCookies(req, '/login?oauth_error=exchange_failed', pendingCookies)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return redirectWithCookies(req, '/login?oauth_error=user_missing', pendingCookies)

  const { data: accessState } = await supabase.rpc('get_my_auth_access_state')
  if (accessState && typeof accessState === 'object' && !Array.isArray(accessState)) {
    const role = typeof accessState.role === 'string' ? accessState.role : null
    const status = typeof accessState.account_status === 'string' ? accessState.account_status : null
    const anonymized = accessState.is_anonymized === true

    if (status === 'restricted' || anonymized) {
      await supabase.auth.signOut()
      return redirectWithCookies(req, '/login?auth_error=account_unavailable', pendingCookies)
    }

    if (role && AUTH_DASHBOARDS[role]) {
      const { data: onboarding, error: onboardingErr } = await supabase.rpc('get_my_onboarding_state')
      if (!onboardingErr && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
        const state = typeof onboarding.state === 'string' ? onboarding.state : null
        const destination = typeof onboarding.destination === 'string' ? onboarding.destination : null
        if (destination && state && state !== 'unknown_role') {
          if (state === 'ready' && next && roleCanVisit(role, next)) {
            return redirectWithCookies(req, next, pendingCookies)
          }
          return redirectWithCookies(req, destination, pendingCookies)
        }
      }
      return redirectWithCookies(req, AUTH_DASHBOARDS[role], pendingCookies)
    }
  }

  // Existing users without a usable profile fail closed. A UI-selected role is never authority.
  // New OAuth sign-ups may use the validated role only to choose onboarding; server-side onboarding
  // remains responsible for actually provisioning any privileged state.
  const identityCreatedAt = Date.parse(user.created_at)
  const recentIdentity = Number.isFinite(identityCreatedAt) && Date.now() - identityCreatedAt < 5 * 60 * 1000
  if (intent === 'signup' && recentIdentity && requestedRole) {
    return redirectWithCookies(req, FIRST_ACCESS[requestedRole], pendingCookies)
  }

  await supabase.auth.signOut()
  return redirectWithCookies(req, '/login?auth_error=profile_incomplete', pendingCookies)
}
