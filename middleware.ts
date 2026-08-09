import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student', '/hq']
const HQ_PATH_HEADER = 'x-vibeschool-hq-path'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  if (pathname.startsWith('/hq')) requestHeaders.set(HQ_PATH_HEADER, pathname)

  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } })
  let supabaseResponse = nextResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = nextResponse()
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
  const isHQLogin = pathname === '/hq/login'
  const isHQRecovery = pathname === '/hq/reset-password'
  const isHQPublicAuthRoute = isHQLogin || isHQRecovery
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected && !user && !isHQPublicAuthRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = pathname.startsWith('/hq') ? '/hq/login' : '/'
    loginUrl.searchParams.set('redirect', pathname)
    return redirectWithAuth(loginUrl)
  }

  if (user && pathname.startsWith('/hq') && !isHQPublicAuthRoute) {
    const { data: access, error } = await supabase.rpc('hq_check_owner_access', { p_surface: pathname })
    const allowed = !error && Boolean((access as { allowed?: boolean } | null)?.allowed)
    if (!allowed) {
      const deniedUrl = request.nextUrl.clone()
      deniedUrl.pathname = '/'
      deniedUrl.search = ''
      deniedUrl.searchParams.set('hq', 'denied')
      return redirectWithAuth(deniedUrl)
    }
  }

  if (user && isHQLogin) {
    const { data: access } = await supabase.rpc('hq_check_owner_access', { p_surface: '/hq/login' })
    if (Boolean((access as { allowed?: boolean } | null)?.allowed)) {
      const hqUrl = request.nextUrl.clone()
      hqUrl.pathname = '/hq'
      hqUrl.search = ''
      return redirectWithAuth(hqUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
