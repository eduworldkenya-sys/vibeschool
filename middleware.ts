import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/academy/signin',
  '/academy/signup',
  '/academy/complete-profile',
  '/academy/select-role',
  '/admin/login',
  '/select',
  '/',
]

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } })
  const { pathname } = req.nextUrl

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: { headers: req.headers } })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/academy/signin'
    return NextResponse.redirect(redirectUrl)
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
