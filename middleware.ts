import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_DASHBOARDS, requiredRoleForPath, safeInternalPath } from '@/lib/auth-routing'

const HQ_PUBLIC_AUTH_ROUTES = new Set(['/hq/login', '/hq/reset-password'])
const PUBLIC_AUTH_ROUTES = new Set(['/login', '/reset-password'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/hq')) {
    const response = NextResponse.next({ request })
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    if (HQ_PUBLIC_AUTH_ROUTES.has(pathname)) return response
    // HQ keeps its own isolated owner gate. Never mix the product session with HQ authority.
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

  // Server-side requests must validate the current identity instead of trusting UI role state.
  const { data: { user } } = await supabase.auth.getUser()
  const requiredRole = requiredRoleForPath(pathname)

  if (requiredRole && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return redirectWithAuth(loginUrl)
  }

  let resolvedRole: string | null = null
  let accountStatus: string | null = null
  let isAnonymized = false

  if (user) {
    const { data: accessState } = await supabase.rpc('get_my_auth_access_state')
    if (accessState && typeof accessState === 'object' && !Array.isArray(accessState)) {
      resolvedRole = typeof accessState.role === 'string' ? accessState.role : null
      accountStatus = typeof accessState.account_status === 'string' ? accessState.account_status : null
      isAnonymized = accessState.is_anonymized === true
    } else {
      const { data: rpcRole } = await supabase.rpc('get_my_role')
      resolvedRole = typeof rpcRole === 'string' ? rpcRole : null
    }
  }

  const accessBlocked = !!user && (accountStatus === 'restricted' || isAnonymized)
  if (accessBlocked && requiredRole) {
    const blockedUrl = request.nextUrl.clone()
    blockedUrl.pathname = '/login'
    blockedUrl.search = ''
    blockedUrl.searchParams.set('auth_error', 'account_unavailable')
    return redirectWithAuth(blockedUrl)
  }

  if (requiredRole && user && resolvedRole !== requiredRole) {
    const destination = resolvedRole ? AUTH_DASHBOARDS[resolvedRole] : undefined
    const target = request.nextUrl.clone()
    target.pathname = destination ?? '/login'
    target.search = ''
    if (!destination) target.searchParams.set('auth_error', 'profile_incomplete')
    return redirectWithAuth(target)
  }

  if ((pathname === '/' || PUBLIC_AUTH_ROUTES.has(pathname)) && user && !accessBlocked) {
    const destination = resolvedRole ? AUTH_DASHBOARDS[resolvedRole] : undefined
    if (destination && pathname !== '/reset-password') {
      const requested = safeInternalPath(request.nextUrl.searchParams.get('redirect'))
      const destinationUrl = request.nextUrl.clone()
      destinationUrl.pathname = requested && requiredRoleForPath(requested) === resolvedRole ? requested : destination
      destinationUrl.search = ''
      return redirectWithAuth(destinationUrl)
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
