import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/admin/login',
  '/admin/signup',
  '/admin/reset-password',
  '/select',
])

const ROLE_HOMES: Record<string, string> = {
  teacher: '/teacher',
  admin:   '/admin',
  parent:  '/parent',
  student: '/student',
}

function getRouteRole(pathname: string): string | null {
  if (pathname.startsWith('/teacher')) return 'teacher'
  if (pathname.startsWith('/admin'))   return 'admin'
  if (pathname.startsWith('/parent'))  return 'parent'
  if (pathname.startsWith('/student')) return 'student'
  return null
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options as any)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedPrefixes = ['/teacher', '/admin', '/parent', '/student', '/select', '/global']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const role = getRouteRole(pathname)
    const loginUrl = role === 'admin' ? '/admin/login' : role ? `/?role=${role}` : '/'
    return NextResponse.redirect(new URL(loginUrl, req.url))
  }

  if (user) {
    let userRole = req.cookies.get('vibe_role')?.value

    if (!userRole) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      userRole = profile?.role ?? undefined

      if (userRole) {
        res.cookies.set('vibe_role', userRole, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60,
          path: '/',
        })
      }
    }

    const routeRole = getRouteRole(pathname)
    if (routeRole && userRole !== routeRole && userRole !== 'admin') {
      const home = ROLE_HOMES[userRole ?? ''] ?? '/'
      return NextResponse.redirect(new URL(home, req.url))
    }

    if (pathname.startsWith('/global') && userRole !== 'global_user') {
      const home = ROLE_HOMES[userRole ?? ''] ?? '/'
      return NextResponse.redirect(new URL(home, req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/admin/:path*',
    '/parent/:path*',
    '/student/:path*',
    '/select/:path*',
    '/global/:path*',
  ],
}
