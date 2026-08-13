import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student']
const ROLE_ROOTS = new Set(PROTECTED_PREFIXES)
const HQ_PUBLIC_AUTH_ROUTES = new Set(['/hq/login', '/hq/reset-password'])

function isSafeDestination(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

function destinationPrefix(destination: string): string | null {
  return PROTECTED_PREFIXES.find(prefix => destination === prefix || destination.startsWith(`${prefix}/`)) ?? null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/hq')) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    if (HQ_PUBLIC_AUTH_ROUTES.has(pathname)) return response
    return response
  }

  let supabaseResponse = NextResponse.next()
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
    return response
  }

  function redirectTo(destination: string) {
    const destinationUrl = request.nextUrl.clone()
    destinationUrl.pathname = destination
    destinationUrl.search = ''
    return redirectWithAuth(destinationUrl)
  }

  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return redirectWithAuth(loginUrl)
  }

  if (user && (isProtected || pathname === '/' || pathname === '/login')) {
    const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')

    if (!onboardingError && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
      const state = typeof onboarding.state === 'string' ? onboarding.state : null
      const destination = isSafeDestination(onboarding.destination) ? onboarding.destination : null

      if (destination && state && state !== 'unknown_role') {
        if (pathname === '/' || pathname === '/login') {
          return redirectTo(destination)
        }

        if (isProtected) {
          const canonicalPrefix = destinationPrefix(destination)
          const currentPrefix = PROTECTED_PREFIXES.find(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? null

          // Required onboarding/connect steps are authoritative. An authenticated
          // user cannot bypass them by entering a dashboard URL directly.
          if (state !== 'ready' && pathname !== destination) {
            return redirectTo(destination)
          }

          // Ready users should stay inside their canonical role surface. This
          // also converts legacy role-root redirects (for example /teacher)
          // into the resolver's current destination (/teacher/pulse).
          if (state === 'ready' && canonicalPrefix && currentPrefix !== canonicalPrefix) {
            return redirectTo(destination)
          }

          if (state === 'ready' && ROLE_ROOTS.has(pathname) && pathname !== destination) {
            return redirectTo(destination)
          }
        }
      }
    }
  }

  if (!user && pathname === '/') {
    const welcomeUrl = request.nextUrl.clone()
    welcomeUrl.pathname = '/welcome'
    return copyAuthState(NextResponse.rewrite(welcomeUrl))
  }

  if (!user && pathname === '/login') {
    const authUrl = request.nextUrl.clone()
    authUrl.pathname = '/'
    return copyAuthState(NextResponse.rewrite(authUrl))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
