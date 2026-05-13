import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED = ['/academy/dashboard', '/global/dashboard']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    const signinPath = pathname.startsWith('/academy')
      ? '/academy/signin'
      : '/global/signin'
    return NextResponse.redirect(new URL(signinPath, req.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  if (pathname.startsWith('/global/dashboard') && role !== 'admin') {
    return NextResponse.redirect(new URL('/global/signin', req.url))
  }

  if (pathname.startsWith('/academy/dashboard') && role !== 'teacher') {
    return NextResponse.redirect(new URL('/academy/signin', req.url))
  }

  return res
}

export const config = {
  matcher: ['/academy/dashboard/:path*', '/global/dashboard/:path*'],
}
