import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student']
const HQ_PUBLIC_AUTH_ROUTES = new Set(['/hq/login', '/hq/reset-password'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // HQ authentication is intentionally isolated in its own browser client/storage
  // and must not consume or mutate the normal Student/Teacher/Parent/Admin session.
  // HQ authorization is re-checked inside the HQ surface using hq_check_owner_access.
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
          supabaseResponse = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
          Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => {
            if (value) supabaseResponse.headers.set(name, String(value))
          })
        },
      },
    }
  )

  function redirectWithAuth(url: URL) {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    for (const header of ['cache-control', 'expires', 'pragma']) {
      const value = supabaseResponse.headers.get(header)
      if (value) response.headers.set(header, value)
    }
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.searchParams.set('redirect', pathname)
    return redirectWithAuth(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
