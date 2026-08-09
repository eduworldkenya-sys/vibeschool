import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student', '/hq']
const HQ_LOGIN_PATH = '/hq/login'

function isWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-vibeschool-pathname', pathname)

  const makeNextResponse = () => NextResponse.next({
    request: { headers: requestHeaders },
  })

  let supabaseResponse = makeNextResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = makeNextResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isHQ = isWithin(pathname, '/hq')
  const isHQLogin = pathname === HQ_LOGIN_PATH
  const isProtected = PROTECTED_PREFIXES.some(prefix => isWithin(pathname, prefix))

  // The dedicated HQ login page must be reachable without an existing session.
  // All other protected application surfaces still require authentication.
  if (isProtected && !user && !isHQLogin) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // HQ authorization is independent from profile.role. Only the server-backed
  // platform_owners allowlist is an authorization boundary.
  if (isHQ && user) {
    const { data: isOwner, error: ownerError } = await supabase.rpc('is_platform_owner')

    // Fail closed on lookup errors. A database/auth outage must never turn HQ
    // into an authenticated-user surface.
    if (ownerError || !isOwner) {
      if (!ownerError) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
        const userAgent = request.headers.get('user-agent') ?? null
        await supabase.rpc('record_hq_access_attempt', {
          p_outcome: 'denied_not_owner',
          p_ip: ip,
          p_user_agent: userAgent,
        })
      }

      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = '/'
      homeUrl.search = ''
      return NextResponse.redirect(homeUrl)
    }

    // An already-authenticated owner does not need to see the credential form.
    if (isHQLogin) {
      const hqUrl = request.nextUrl.clone()
      hqUrl.pathname = '/hq'
      hqUrl.search = ''
      return NextResponse.redirect(hqUrl)
    }

    const alreadyLogged = request.cookies.get('hq_access_logged')?.value === '1'
    if (!alreadyLogged) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const userAgent = request.headers.get('user-agent') ?? null
      await supabase.rpc('record_hq_access_attempt', {
        p_outcome: 'granted',
        p_ip: ip,
        p_user_agent: userAgent,
      })
      supabaseResponse.cookies.set('hq_access_logged', '1', {
        maxAge: 60 * 60 * 8,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
