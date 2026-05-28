import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code      = searchParams.get('code')
  const next      = searchParams.get('next')
  const role      = searchParams.get('role') ?? searchParams.get('role_hint') ?? 'teacher'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (next) return NextResponse.redirect(new URL(next, req.url))

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.role) {
          const destinations: Record<string, string> = {
            teacher: '/teacher',
            admin:   '/admin',
            parent:  '/parent',
            student: '/student',
          }
          return NextResponse.redirect(new URL(destinations[profile.role] ?? '/teacher', req.url))
        }

        // New Google user — send to complete profile with role hint
        return NextResponse.redirect(
          new URL(`/academy/complete-profile?role=${role}`, req.url)
        )
      }
    }
  }

  // All failures go back to login
  return NextResponse.redirect(new URL('/academy', req.url))
}
