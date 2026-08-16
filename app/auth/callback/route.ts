import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const FIRST_ACCESS: Record<string, string> = {
  teacher: '/teacher/onboarding/school',
  parent: '/parent/connect',
  student: '/student',
  admin: '/admin/onboarding',
  global_user: '/global',
}

function safeRequestedRole(value: string | null): string | null {
  return value && Object.prototype.hasOwnProperty.call(FIRST_ACCESS, value) ? value : null
}

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function safeDestination(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const requestedRole = safeRequestedRole(searchParams.get('role'))

  if (!code) return NextResponse.redirect(new URL('/login?error=oauth_callback', req.url))

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return NextResponse.redirect(new URL('/login?error=oauth_session', req.url))

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.redirect(new URL('/login?error=oauth_user', req.url))

  const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
  if (!onboardingError && onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
    const state = typeof onboarding.state === 'string' ? onboarding.state : null
    const destination = safeDestination(onboarding.destination)

    if (destination && state && state !== 'unknown_role') {
      // Only a fully onboarded account may honor a caller-provided in-app destination.
      // Incomplete accounts always go to the canonical resolver destination.
      const target = state === 'ready' && next ? next : destination
      return NextResponse.redirect(new URL(target, req.url))
    }
  }

  // A brand-new OAuth identity may legitimately have no profile yet. Only use the
  // role that was explicitly validated before OAuth; otherwise fail closed.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role && requestedRole) {
    return NextResponse.redirect(new URL(FIRST_ACCESS[requestedRole], req.url))
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?error=onboarding_state', req.url))
}
