import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student', '/hq']
const HQ_LOGIN_PATH = '/hq/login'
const SERVICE_UNAVAILABLE_PATH = '/service-unavailable'

type ProductGuard = { productKey: string; policyKey: string; label: string }

function isWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function productGuardsFor(pathname: string): ProductGuard[] {
  const guards: ProductGuard[] = []

  if (isWithin(pathname, '/student')) guards.push({ productKey: 'student', policyKey: 'student.enabled', label: 'Student' })
  if (isWithin(pathname, '/teacher')) guards.push({ productKey: 'teacher', policyKey: 'teacher.enabled', label: 'Teacher' })
  if (isWithin(pathname, '/parent')) guards.push({ productKey: 'parent', policyKey: 'parent.enabled', label: 'Parent' })
  if (isWithin(pathname, '/admin') && !isWithin(pathname, '/admin/login') && !isWithin(pathname, '/admin/reset-password') && !isWithin(pathname, '/admin/signup')) {
    guards.push({ productKey: 'school_admin', policyKey: 'school_admin.enabled', label: 'School Admin' })
  }

  if (
    isWithin(pathname, '/learn') ||
    isWithin(pathname, '/teacher/vibelearn') ||
    isWithin(pathname, '/parent/vibe-learn') ||
    isWithin(pathname, '/student/vibelearn')
  ) guards.push({ productKey: 'vibelearn', policyKey: 'vibelearn.enabled', label: 'VibeLearn' })

  if (isWithin(pathname, '/read/textbook') || isWithin(pathname, '/vibebooks')) {
    guards.push({ productKey: 'vibebooks', policyKey: 'vibebooks.enabled', label: 'VibeBooks' })
  }

  if (
    pathname.includes('/vibelab') ||
    pathname.includes('/vibe-lab') ||
    isWithin(pathname, '/labs')
  ) guards.push({ productKey: 'vibelabs', policyKey: 'vibelabs.enabled', label: 'VibeLabs' })

  return guards
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

  if (isProtected && !user && !isHQLogin) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Enforce HQ product availability at the server routing boundary. UI gates are
  // presentation only; this prevents direct URL navigation from bypassing policy.
  if (user && pathname !== SERVICE_UNAVAILABLE_PATH && !isHQ) {
    for (const guard of productGuardsFor(pathname)) {
      const { error: guardError } = await supabase.rpc('hq_assert_product_enabled', {
        p_product_key: guard.productKey,
        p_policy_key: guard.policyKey,
      })
      if (guardError) {
        const unavailableUrl = request.nextUrl.clone()
        unavailableUrl.pathname = SERVICE_UNAVAILABLE_PATH
        unavailableUrl.search = ''
        unavailableUrl.searchParams.set('product', guard.label)
        return NextResponse.redirect(unavailableUrl)
      }
    }
  }

  // HQ authorization is independent from profile.role. Only the server-backed
  // platform_owners allowlist is an authorization boundary.
  if (isHQ && user) {
    const { data: isOwner, error: ownerError } = await supabase.rpc('is_platform_owner')

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
