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

  const res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedPrefixes = ['/teacher', '/admin', '/parent', '/student', '/select', '/global']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    return NextResponse.redirect(new URL('/', req.url))
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
