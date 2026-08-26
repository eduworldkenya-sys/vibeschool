import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AUTH_DASHBOARDS, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

const SELF_SERVICE_ROLES = new Set(['teacher', 'parent', 'global_user'])

type AuthIntent = 'signin' | 'signup' | 'recovery'
type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}
type OnboardingState = { state?: unknown; destination?: unknown }
type AccessState = {
  role: string | null
  status: string | null
  anonymized: boolean
  reasonCode: string | null
}

function safeRequestedRole(value: string | null): string | null {
  return value && Object.prototype.hasOwnProperty.call(AUTH_DASHBOARDS, value) ? value : null
}

function safeIntent(value: string | null): AuthIntent | null {
  return value === 'signin' || value === 'signup' || value === 'recovery' ? value : null
}

function safeFlowId(value: string | null): string {
  const cleaned = (value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)
  return cleaned || crypto.randomUUID()
}

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.nextUrl.origin))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

function authError(req: NextRequest, reason: string, pendingCookies: PendingCookie[]) {
  return redirectWithCookies(req, `/auth/error?reason=${encodeURIComponent(reason)}`, pendingCookies)
}

function logStage(stage: string, flowId: string, detail?: string) {
  console.info(JSON.stringify({ scope: 'auth_journey', stage, flow_id: flowId, detail }))
}

function accessFailureReason(access: AccessState): string | null {
  if (access.reasonCode === 'PROFILE_MISSING') return 'profile_missing'
  if (access.reasonCode === 'ADMIN_MEMBERSHIP_MISSING') return 'admin_membership_missing'
  if (access.reasonCode === 'AMBIGUOUS_LEARNER_IDENTITY') return 'identity_conflict'
  if (
    access.anonymized ||
    access.reasonCode === 'ACCOUNT_ANONYMIZED' ||
    access.reasonCode === 'ACCOUNT_NOT_ACTIVE' ||
    (access.status !== null && access.status !== 'active')
  ) return 'account_unavailable'
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'))
  const requestedRole = safeRequestedRole(searchParams.get('role'))
  const intent = safeIntent(searchParams.get('intent'))
  const flowId = safeFlowId(searchParams.get('flow'))
  const pendingCookies: PendingCookie[] = []

  logStage('provider_returned', flowId, code ? 'code_present' : 'code_missing')
  if (!code) return authError(req, 'missing_code', pendingCookies)
  if (!intent) return authError(req, 'invalid_intent', pendingCookies)

  const cookieStore = await cookies()
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

  if (intent === 'recovery') {
    logStage('recovery_session_established', flowId)
    return redirectWithCookies(req, '/auth/reset-password', pendingCookies)
  }

  const resolveAccess = async (): Promise<AccessState | null> => {
    const { data, error } = await supabase.rpc('get_my_auth_access_state')
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
    return {
      role: typeof data.role === 'string' ? data.role : null,
      status: typeof data.account_status === 'string' ? data.account_status : null,
      anonymized: data.is_anonymized === true,
      reasonCode: typeof data.reason_code === 'string' ? data.reason_code : null,
    }
  }

  let access = await resolveAccess()
  if (!access) {
    logStage('profile_resolution_failed', flowId)
    return authError(req, 'profile_resolution_failed', pendingCookies)
  }

  const initialFailure = accessFailureReason(access)
  if (initialFailure) {
    if (initialFailure === 'account_unavailable') await supabase.auth.signOut()
    logStage(initialFailure, flowId, access.reasonCode ?? undefined)
    return authError(req, initialFailure, pendingCookies)
  }

  if (!access.role && intent === 'signup') {
    // A new self-service role may only be claimed from the explicit role-unclaimed state.
    // Missing profiles, authority conflicts, or unknown states never enter role claiming.
    if (access.reasonCode !== 'ROLE_UNCLAIMED') {
      logStage('authority_resolution_failed', flowId, access.reasonCode ?? undefined)
      return authError(req, 'authority_resolution_failed', pendingCookies)
    }
    if (!requestedRole || !SELF_SERVICE_ROLES.has(requestedRole)) {
      return authError(req, 'role_required', pendingCookies)
    }
    const { data: claimedRole, error: claimError } = await supabase.rpc('claim_my_initial_role', { p_role: requestedRole })
    if (claimError || claimedRole !== requestedRole) {
      logStage('role_claim_failed', flowId, claimError?.code)
      return authError(req, 'role_claim_failed', pendingCookies)
    }
    access = await resolveAccess()
    if (!access) return authError(req, 'profile_resolution_failed', pendingCookies)
    const postClaimFailure = accessFailureReason(access)
    if (postClaimFailure) {
      logStage(postClaimFailure, flowId, access.reasonCode ?? undefined)
      return authError(req, postClaimFailure, pendingCookies)
    }
  }

  if (!access.role && intent === 'signin') {
    if (access.reasonCode !== 'ROLE_UNCLAIMED') {
      logStage('authority_resolution_failed', flowId, access.reasonCode ?? undefined)
      return authError(req, 'authority_resolution_failed', pendingCookies)
    }
    await supabase.auth.signOut()
    logStage('account_unregistered', flowId)
    return authError(req, 'account_unregistered', pendingCookies)
  }

  const role = access.role
  if (!role || !AUTH_DASHBOARDS[role]) {
    logStage('role_unresolved', flowId, access.reasonCode ?? undefined)
    return authError(req, 'role_unresolved', pendingCookies)
  }
  logStage('profile_resolved', flowId, role)

  // There is deliberately no application-side authority fallback here. The database
  // resolver is the single journey authority. A stale PostgREST schema cache must fail
  // recoverably rather than silently switching to a weaker/contradictory state machine.
  const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
  if (onboardingError) {
    logStage('onboarding_resolution_failed', flowId, onboardingError.code)
    return authError(req, 'onboarding_resolution_failed', pendingCookies)
  }
  if (!onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
    logStage('onboarding_resolution_failed', flowId, 'invalid_payload')
    return authError(req, 'onboarding_resolution_failed', pendingCookies)
  }

  const state = (onboarding as OnboardingState).state
  const destination = (onboarding as OnboardingState).destination
  if (typeof state !== 'string' || typeof destination !== 'string') {
    return authError(req, 'onboarding_invalid', pendingCookies)
  }
  const safeDestination = safeInternalPath(destination)
  if (!safeDestination || !roleCanVisit(role, safeDestination)) {
    logStage('onboarding_invalid', flowId)
    return authError(req, 'onboarding_invalid', pendingCookies)
  }

  logStage('onboarding_resolved', flowId, state)
  const target = state === 'ready' && next && roleCanVisit(role, next) ? next : safeDestination
  logStage('destination_selected', flowId, target)
  return redirectWithCookies(req, target, pendingCookies)
}
