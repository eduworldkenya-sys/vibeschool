import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_DASHBOARDS, requiredRoleForPath, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

const HQ_PUBLIC_AUTH_ROUTES = new Set(['/hq/login', '/hq/reset-password'])
const PUBLIC_AUTH_ROUTES = new Set(['/login', '/reset-password', '/auth/forgot-password', '/auth/reset-password', '/auth/error'])
type OnboardingState = { state?: unknown; destination?: unknown }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.nextUrl.hostname === 'www.vibeschool.co.ke') {
    const canonical = request.nextUrl.clone()
    canonical.hostname = 'vibeschool.co.ke'
    canonical.protocol = 'https:'
    canonical.port = ''
    return NextResponse.redirect(canonical, 308)
  }

  if (pathname.startsWith('/hq')) {
    const response = NextResponse.next({ request })
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    if (HQ_PUBLIC_AUTH_ROUTES.has(pathname)) return response
    return response
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
          Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => {
            if (value) supabaseResponse.headers.set(name, String(value))
          })
        },
      },
    }
  )

  function copyAuthState(response: NextResponse) {
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    for (const header of ['cache-control', 'expires', 'pragma']) {
      const value = supabaseResponse.headers.get(header)
      if (value) response.headers.set(header, value)
    }
    return response
  }

  function redirectWithAuth(url: URL) {
    const response = copyAuthState(NextResponse.redirect(url))
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  }

  function authError(reason: string) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/error'
    url.search = ''
    url.searchParams.set('reason', reason)
    return redirectWithAuth(url)
  }

  const { data: { user } } = await supabase.auth.getUser()
  const requiredRole = requiredRoleForPath(pathname)

  if (requiredRole && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return redirectWithAuth(loginUrl)
  }

  const needsAuthority = !!user && (requiredRole !== null || pathname === '/' || pathname === '/login')
  if (needsAuthority) {
    const [{ data: accessState, error: accessError }, { data: onboarding, error: onboardingError }] = await Promise.all([
      supabase.rpc('get_my_auth_access_state'),
      supabase.rpc('get_my_onboarding_state'),
    ])

    if (accessError || !accessState || typeof accessState !== 'object' || Array.isArray(accessState)) {
      return authError('authority_resolution_failed')
    }

    const role = typeof accessState.role === 'string' ? accessState.role : null
    const status = typeof accessState.account_status === 'string' ? accessState.account_status : null
    const anonymized = accessState.is_anonymized === true

    if (status === 'restricted' || anonymized) return authError('account_unavailable')
    if (!role || !AUTH_DASHBOARDS[role]) return authError('authority_resolution_failed')
    if (onboardingError || !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
      return authError('onboarding_resolution_failed')
    }

    const state = (onboarding as OnboardingState).state
    const rawDestination = (onboarding as OnboardingState).destination
    const destination = typeof rawDestination === 'string' ? safeInternalPath(rawDestination) : null
    if (typeof state !== 'string' || !destination || !roleCanVisit(role, destination)) {
      return authError('onboarding_invalid')
    }

    if (state !== 'ready') {
      const current = `${pathname}${request.nextUrl.search}`
      if (current !== destination) {
        const target = request.nextUrl.clone()
        target.pathname = destination.split('?')[0]
        target.search = destination.includes('?') ? destination.slice(destination.indexOf('?')) : ''
        return redirectWithAuth(target)
      }
      return supabaseResponse
    }

    if (requiredRole && requiredRole !== role) {
      const target = request.nextUrl.clone()
      target.pathname = AUTH_DASHBOARDS[role]
      target.search = ''
      return redirectWithAuth(target)
    }

    if (pathname === '/' || pathname === '/login') {
      const requested = safeInternalPath(request.nextUrl.searchParams.get('redirect'))
      const target = request.nextUrl.clone()
      target.pathname = requested && roleCanVisit(role, requested) ? requested : destination
      target.search = ''
      return redirectWithAuth(target)
    }
  }

  // Anonymous visitors now receive the canonical public homepage at `/`.
  // Do not rewrite it to the legacy `/welcome` shell: the public homepage owns
  // its navigation, accessibility, trust and investor/user communication contract.
  if (!user && pathname === '/login') {
    const authUrl = request.nextUrl.clone()
    authUrl.pathname = '/'
    return copyAuthState(NextResponse.rewrite(authUrl))
  }

  if (PUBLIC_AUTH_ROUTES.has(pathname)) {
    supabaseResponse.headers.set('Cache-Control', 'private, no-store')
    supabaseResponse.headers.set('Pragma', 'no-cache')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
