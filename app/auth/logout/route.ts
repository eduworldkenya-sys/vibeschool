import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const pending: PendingCookie[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: PendingCookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pending.push({ name, value, options })
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    // VibeSchool logout is current-session logout. Do not revoke the user's other
    // browser/device sessions as a side effect of changing account on this device.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      const response = NextResponse.json({ ok: false }, { status: 503 })
      response.cookies.set('vibe_role', '', { path: '/', maxAge: 0 })
      return noStore(response)
    }

    const response = NextResponse.json({ ok: true })
    pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    response.cookies.set('vibe_role', '', { path: '/', maxAge: 0 })
    return noStore(response)
  } catch {
    // Network/auth-client exceptions must not be presented as a successful logout.
    // RecoveryActions will keep the user on the safe recovery surface and allow retry.
    const response = NextResponse.json({ ok: false }, { status: 503 })
    response.cookies.set('vibe_role', '', { path: '/', maxAge: 0 })
    return noStore(response)
  }
}
