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

  // Block teacher/admin/parent from accessing /global
  if (user && pathname.startsWith('/global')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role as string | undefined
    if (role && role !== 'global_user') {
      const roleMap: Record<string, string> = {
        teacher: '/teacher',
        admin:   '/admin',
        parent:  '/parent',
      }
      const home = roleMap[role] ?? '/'
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
