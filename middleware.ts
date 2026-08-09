import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/teacher', '/admin', '/parent', '/student', '/hq']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isHQLogin = pathname === '/hq/login'
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected && !user && !isHQLogin) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = pathname.startsWith('/hq') ? '/hq/login' : '/'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname.startsWith('/hq') && !isHQLogin) {
    const { data: access, error } = await supabase.rpc('hq_check_owner_access', { p_surface: pathname })
    const allowed = !error && Boolean((access as { allowed?: boolean } | null)?.allowed)
    if (!allowed) {
      const deniedUrl = request.nextUrl.clone()
      deniedUrl.pathname = '/'
      deniedUrl.search = ''
      deniedUrl.searchParams.set('hq', 'denied')
      return NextResponse.redirect(deniedUrl)
    }
  }

  if (user && isHQLogin) {
    const { data: access } = await supabase.rpc('hq_check_owner_access', { p_surface: '/hq/login' })
    if (Boolean((access as { allowed?: boolean } | null)?.allowed)) {
      const hqUrl = request.nextUrl.clone()
      hqUrl.pathname = '/hq'
      hqUrl.search = ''
      return NextResponse.redirect(hqUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
