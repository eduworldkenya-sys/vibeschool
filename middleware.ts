import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student', '/global']
const ROLE_PREFIX: Record<string, string> = {
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}
const HQ_PUBLIC_AUTH_ROUTES = new Set(['/hq/login', '/hq/reset-password'])

type OnboardingState = { state?: unknown; destination?: unknown }

function routeBelongsToRole(pathname: string, role: string): boolean {
  const prefix = ROLE_PREFIX[role]
  return Boolean(prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`)))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Production has both apex and www attached. Pick one cookie/session origin.
  // Preview/Vercel hosts and the separate HQ host are intentionally untouched.
  if (request.nextUrl.hostname === 'www.vibeschool.co.ke') {
    const canonical = request.nextUrl.clone()
    canonical.hostname = 'vibeschool.co.ke'
    canonical.protocol = 'https:'
    canonical.port = ''
    return NextResponse.redirect(canonical, 308)
  }

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

  function redirectWithAuth(target: string, search?: Record<string, string>) {
    const url = new URL(target, request.nextUrl.origin)
    Object.entries(search ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = copyAuthState(NextResponse.redirect(url))
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))

  if (isProtected && !user) {
    return redirectWithAuth('/login', { redirect: pathname })
  }

  if (user && (isProtected || pathname === '/' || pathname === '/login')) {
    const [{ data: role, error: roleError }, { data: onboarding, error: onboardingError }] = await Promise.all([
      supabase.rpc('get_my_role'),
      supabase.rpc('get_my_onboarding_state'),
    ])

    if (roleError || onboardingError || typeof role !== 'string' || !ROLE_PREFIX[role] ||
        !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
      return redirectWithAuth('/auth/error', { reason: 'authority_resolution_failed' })
    }

    const state = (onboarding as OnboardingState).state
    const destination = (onboarding as OnboardingState).destination
    if (typeof state !== 'string' || typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//')) {
      return redirectWithAuth('/auth/error', { reason: 'onboarding_invalid' })
    }

    if (state !== 'ready') {
      const resolved = new URL(destination, request.nextUrl.origin)
      const current = `${pathname}${request.nextUrl.search}`
      const expected = `${resolved.pathname}${resolved.search}`
      if (current !== expected) return redirectWithAuth(destination)
      return supabaseResponse
    }

    if (isProtected && !routeBelongsToRole(pathname, role)) {
      return redirectWithAuth(destination)
    }

    if (pathname === '/' || pathname === '/login') {
      return redirectWithAuth(destination)
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
