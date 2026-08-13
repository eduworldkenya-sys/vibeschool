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
  parent: '/parent/students',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

function safeRole(value: string | null): string {
  return value && Object.prototype.hasOwnProperty.call(DASHBOARDS, value)
    ? value
    : 'teacher'
}

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: onboarding, error: onboardingErr } = await supabase.rpc('get_my_onboarding_state')

        if (!onboardingErr && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
          const state = typeof onboarding.state === 'string' ? onboarding.state : null
          const destination = typeof onboarding.destination === 'string' ? onboarding.destination : null

          // The database resolver is authoritative for onboarding state.
          // Do not let a requested dashboard bypass required onboarding.
          if (destination && state && state !== 'unknown_role') {
            const ready = state === 'ready'
            const target = ready && next ? next : destination
            return NextResponse.redirect(new URL(target, req.url))
          }
        }

        // Safe fallback for an older/missing resolver state.
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.role && DASHBOARDS[profile.role]) {
          return NextResponse.redirect(new URL(DASHBOARDS[profile.role], req.url))
        }

        // New Google user with no profile yet — use the role selected before OAuth.
        const destination = FIRST_ACCESS[requestedRole] ?? '/'
        return NextResponse.redirect(new URL(destination, req.url))
      }
    }
  }

  return NextResponse.redirect(new URL('/', req.url))
}
