import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SELF_SERVICE_ROLES = new Set(['teacher', 'parent', 'global_user'])
const ROLE_PREFIXES: Record<string, string[]> = {
  teacher: ['/teacher'],
  parent: ['/parent'],
  student: ['/student'],
  admin: ['/admin'],
  global_user: ['/global'],
}

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

type OnboardingState = {
  state?: unknown
  destination?: unknown
}

function requestedRole(value: string | null): string | null {
  return value && SELF_SERVICE_ROLES.has(value) ? value : null
}

function requestedIntent(value: string | null): 'signin' | 'signup' | null {
  return value === 'signin' || value === 'signup' ? value : null
}

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return null
    return decoded
  } catch {
    return null
  }
}

function nextMatchesRole(next: string, role: string): boolean {
  return (ROLE_PREFIXES[role] ?? []).some(prefix => next === prefix || next.startsWith(`${prefix}/`))
}

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.nextUrl.origin))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  return response
}

function authError(req: NextRequest, reason: string, pendingCookies: PendingCookie[]) {
  return redirectWithCookies(req, `/auth/error?reason=${encodeURIComponent(reason)}`, pendingCookies)
}

function logStage(stage: string, flowId: string, detail?: string) {
  console.info(JSON.stringify({ scope: 'auth_journey', stage, flow_id: flowId, detail }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const roleIntent = requestedRole(searchParams.get('role'))
  const intent = requestedIntent(searchParams.get('intent'))
  const flowId = searchParams.get('flow')?.slice(0, 80) || crypto.randomUUID()
  const pendingCookies: PendingCookie[] = []

  logStage('provider_returned', flowId, code ? 'code_present' : 'code_missing')
  if (!code) return authError(req, 'missing_code', pendingCookies)
  if (!intent) return authError(req, 'invalid_intent', pendingCookies)

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
  if (exchangeError) {
    logStage('code_exchange_failed', flowId, exchangeError.name)
    return authError(req, 'exchange_failed', pendingCookies)
  }
  logStage('code_exchanged', flowId)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    logStage('session_failed', flowId, userError?.name)
    return authError(req, 'session_failed', pendingCookies)
  }
  logStage('session_established', flowId)

  let { data: role, error: roleError } = await supabase.rpc('get_my_role')
  if (roleError) {
    logStage('profile_resolution_failed', flowId, roleError.code)
    return authError(req, 'profile_resolution_failed', pendingCookies)
  }

  // Only explicit signup may classify an unclassified account. Sign-in never
  // provisions authority. Existing database roles always win for both flows.
  if (!role && intent === 'signup') {
    if (!roleIntent) return authError(req, 'role_required', pendingCookies)
    const claim = await supabase.rpc('claim_my_initial_role', { p_role: roleIntent })
    if (claim.error) {
      logStage('role_claim_failed', flowId, claim.error.code)
      return authError(req, 'role_claim_failed', pendingCookies)
    }
    role = claim.data
  }

  if (!role && intent === 'signin') {
    logStage('account_unregistered', flowId)
    return authError(req, 'account_unregistered', pendingCookies)
  }

  if (typeof role !== 'string' || !ROLE_PREFIXES[role]) {
    logStage('role_unresolved', flowId)
    return authError(req, 'role_unresolved', pendingCookies)
  }
  logStage('profile_resolved', flowId, role)

  const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
  if (onboardingError || !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
    logStage('onboarding_resolution_failed', flowId, onboardingError?.code)
    return authError(req, 'onboarding_resolution_failed', pendingCookies)
  }

  const state = (onboarding as OnboardingState).state
  const destination = (onboarding as OnboardingState).destination
  if (typeof state !== 'string' || typeof destination !== 'string' || !destination.startsWith('/')) {
    logStage('onboarding_invalid', flowId)
    return authError(req, 'onboarding_invalid', pendingCookies)
  }
  logStage('onboarding_resolved', flowId, state)

  const target = state === 'ready' && next && nextMatchesRole(next, role) ? next : destination
  logStage('destination_reached', flowId, target)
  return redirectWithCookies(req, target, pendingCookies)
}
