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

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function safeRequestedRole(value: string | null): string | null {
  return value && Object.prototype.hasOwnProperty.call(DASHBOARDS, value)
    ? value
    : null
}

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function redirectWithCookies(req: NextRequest, target: string, pendingCookies: PendingCookie[]) {
  const response = NextResponse.redirect(new URL(target, req.url))
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const requestedRole = safeRequestedRole(searchParams.get('role'))
  const pendingCookies: PendingCookie[] = []

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: PendingCookie[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options })
              cookieStore.set(name, value, options)
            })
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
            return redirectWithCookies(req, target, pendingCookies)
          }
        }

        // Safe fallback for an older/missing resolver state.
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.role && DASHBOARDS[profile.role]) {
          return redirectWithCookies(req, DASHBOARDS[profile.role], pendingCookies)
        }

        // New Google user with no profile yet — use only a validated role
        // selected before OAuth. Never default an invalid/missing role to teacher.
        const destination = requestedRole ? FIRST_ACCESS[requestedRole] : '/'
        return redirectWithCookies(req, destination, pendingCookies)
      }
    }

    const reason = error ? 'exchange_failed' : 'user_missing'
    return redirectWithCookies(req, `/login?oauth_error=${reason}`, pendingCookies)
  }

  return redirectWithCookies(req, '/login?oauth_error=missing_code', pendingCookies)
}
