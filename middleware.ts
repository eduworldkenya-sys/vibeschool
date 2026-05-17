import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // ─── Admin route protection ───────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const { data: { user } } = await supabase.auth.getUser()

    // Not logged in → login page
    if (!user) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // Logged in — check role is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin' || !profile.school_id) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  // ─── Existing routes ──────────────────────────────────────
  await supabase.auth.getUser()

  return res
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/academy/:path*',
    '/global/:path*',
    '/admin/:path*',
  ],
}
