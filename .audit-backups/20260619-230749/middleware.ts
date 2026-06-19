import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/admin/login',
  '/admin/signup',
  '/admin/reset-password',
])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedPrefixes = ['/teacher', '/admin', '/parent', '/student', '/select']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const role = pathname.startsWith('/teacher') ? 'teacher'
      : pathname.startsWith('/admin')   ? 'admin'
      : pathname.startsWith('/parent')  ? 'parent'
      : pathname.startsWith('/student') ? 'student'
      : 'teacher'
    return NextResponse.redirect(new URL(`/?role=${role}`, req.url))
  }

  // Role enforcement: a logged-in user of one role should not be able to
  // browse another role's protected area just because they're authenticated.
  // '/select' is intentionally excluded — it is reachable by multiple roles.
  if (isProtected && user) {
    const expectedRole = pathname.startsWith('/teacher') ? 'teacher'
      : pathname.startsWith('/admin')   ? 'admin'
      : pathname.startsWith('/parent')  ? 'parent'
      : pathname.startsWith('/student') ? 'student'
      : null

    if (expectedRole) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role && profile.role !== expectedRole) {
        const dest = profile.role === 'global_user' ? '/global' : `/${profile.role}`
        return NextResponse.redirect(new URL(dest, req.url))
      }
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
  ],
}
