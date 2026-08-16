import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
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

  await supabase.auth.signOut()

  const response = NextResponse.json({ ok: true })
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  response.cookies.set('vibe_role', '', { path: '/', maxAge: 0 })
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  return response
}
