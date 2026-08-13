import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DASHBOARDS: Record<string, string> = {
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

const FIRST_ACCESS: Record<string, string> = {
  teacher: '/teacher/onboarding/school',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

function safeRole(value: string | null): string {
  return value && Object.prototype.hasOwnProperty.call(DASHBOARDS, value)
    ? value
    : 'teacher'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const requestedRole = safeRole(searchParams.get('role'))

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

        // Existing user — the database is authoritative for role.
        if (profile?.role && DASHBOARDS[profile.role]) {
          return NextResponse.redirect(new URL(DASHBOARDS[profile.role], req.url))
        }

        // New Google user — never leave the user at a root page that ignores
        // the role hint. Send them directly to the shortest valid first-access
        // destination for the role selected before OAuth.
        const destination = FIRST_ACCESS[requestedRole] ?? '/'
        return NextResponse.redirect(new URL(destination, req.url))
      }
    }
  }

  // All failures → root
  return NextResponse.redirect(new URL('/', req.url))
}
