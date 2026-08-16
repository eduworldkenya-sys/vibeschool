import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { normalizeOAuthIntent, normalizeOAuthRole, safeRelativePath } from '@/lib/auth/oauth'

const DASHBOARDS: Record<string, string> = {
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

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

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.url))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

function loginError(req: NextRequest, reason: string, pendingCookies: PendingCookie[], role: string | null) {
  const path = role === 'global_user' ? '/login/global' : role && DASHBOARDS[role] ? `/login/${role}` : '/login'
  return redirectWithCookies(req, `${path}?oauth_error=${encodeURIComponent(reason)}`, pendingCookies)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const providerError = searchParams.get('error')
  const intent = normalizeOAuthIntent(searchParams.get('intent'))
  const requestedRole = normalizeOAuthRole(searchParams.get('role'))
  const next = safeRelativePath(searchParams.get('next'))
  const pendingCookies: PendingCookie[] = []

  if (providerError) {
    return loginError(req, providerError === 'access_denied' ? 'cancelled' : 'provider_failed', pendingCookies, requestedRole)
  }

  // Intent and role are routing hints only, never authorization. Requiring them
  // prevents malformed/replayed callback URLs from acquiring a privileged default.
  if (!intent || !requestedRole) {
    return loginError(req, 'invalid_request', pendingCookies, requestedRole)
  }

  if (!code) return loginError(req, 'missing_code', pendingCookies, requestedRole)

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
    },
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return loginError(req, 'exchange_failed', pendingCookies, requestedRole)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return loginError(req, 'user_missing', pendingCookies, requestedRole)

  // Database state is authoritative. A role supplied in the URL must never
  // overwrite an existing profile or change its destination.
  const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
  if (!onboardingError && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
    const state = typeof onboarding.state === 'string' ? onboarding.state : null
    const destination = typeof onboarding.destination === 'string' ? safeRelativePath(onboarding.destination) : null
    if (destination && state && state !== 'unknown_role') {
      const target = state === 'ready' && next ? next : destination
      return redirectWithCookies(req, target, pendingCookies)
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileError && profile?.role && DASHBOARDS[profile.role]) {
    return redirectWithCookies(req, DASHBOARDS[profile.role], pendingCookies)
  }

  // A sign-in flow is not allowed to bootstrap role-bearing product state.
  // New identities must deliberately enter through a signup flow.
  if (intent === 'signin') {
    await supabase.auth.signOut()
    return loginError(req, 'account_setup_required', pendingCookies, requestedRole)
  }

  // For a genuinely new OAuth identity, requestedRole only chooses the first
  // onboarding surface. The onboarding flow/database remains responsible for
  // creating authoritative role/profile state.
  return redirectWithCookies(req, FIRST_ACCESS[requestedRole], pendingCookies)
}
