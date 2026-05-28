import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = req.nextUrl

  // Protected routes — redirect to signin if no session
  const protectedPrefixes = ['/teacher', '/admin', '/parent', '/student', '/select']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const role = pathname.startsWith('/teacher') ? 'teacher'
      : pathname.startsWith('/admin')   ? 'admin'
      : pathname.startsWith('/parent')  ? 'parent'
      : pathname.startsWith('/student') ? 'student'
      : 'teacher'
    return NextResponse.redirect(new URL(`/academy/signin?role=${role}`, req.url))
  }

  // Already signed in — don't let them see signin/signup pages
  if (user && (pathname.startsWith('/academy/signin') || pathname.startsWith('/academy/signup') || pathname.startsWith('/global/signin'))) {
    return NextResponse.redirect(new URL('/academy/complete-profile', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/academy/:path*',
    '/global/:path*',
    '/admin/:path*',
    '/parent/:path*',
    '/student/:path*',
    '/select/:path*',
  ],
}
