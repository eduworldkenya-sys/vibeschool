import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AUTH_DASHBOARDS, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

const FIRST_ACCESS: Record<string, string> = {
  teacher: '/teacher/onboarding/school',
  parent: '/parent/students',
  global_user: '/global',
}

const OAUTH_SELF_CLAIM_ROLES = new Set(Object.keys(FIRST_ACCESS))

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

  const resolveAccess = async () => {
    const { data } = await supabase.rpc('get_my_auth_access_state')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    return {
      role: typeof data.role === 'string' ? data.role : null,
      status: typeof data.account_status === 'string' ? data.account_status : null,
      anonymized: data.is_anonymized === true,
    }
  }

  let access = await resolveAccess()

  if (access && (access.status === 'restricted' || access.anonymized)) {
    await supabase.auth.signOut()
    return redirectWithCookies(req, '/login?auth_error=account_unavailable', pendingCookies)
  }

  if (!access?.role && intent === 'signup' && requestedRole && OAUTH_SELF_CLAIM_ROLES.has(requestedRole)) {
    const { data: claimedRole, error: claimError } = await supabase.rpc('claim_initial_oauth_role', {
      p_requested_role: requestedRole,
    })

    if (claimError || claimedRole !== requestedRole) {
      await supabase.auth.signOut()
      return redirectWithCookies(req, '/login?auth_error=oauth_onboarding_failed', pendingCookies)
    }

    access = await resolveAccess()
  }

  if (access?.role && AUTH_DASHBOARDS[access.role]) {
    const role = access.role
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

    if (intent === 'signup' && requestedRole === role && FIRST_ACCESS[role]) {
      return redirectWithCookies(req, FIRST_ACCESS[role], pendingCookies)
    }

    return redirectWithCookies(req, AUTH_DASHBOARDS[role], pendingCookies)
  }

  // Existing identities without a usable profile fail closed. Admin and student identities
  // are never self-provisioned from OAuth request parameters; they require their governed flows.
  await supabase.auth.signOut()
  return redirectWithCookies(req, '/login?auth_error=profile_incomplete', pendingCookies)
}
