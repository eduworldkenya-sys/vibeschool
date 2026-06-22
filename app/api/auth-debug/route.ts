import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll()
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cookies: {
      all_names: allCookies.map(c => c.name),
      sb_cookies: sbCookies.map(c => ({ name: c.name, value_length: c.value.length })),
      vibe_role: req.cookies.get('vibe_role')?.value ?? null,
    },
    server_auth: {
      user_found: !!user,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      error: error?.message ?? null,
    },
    supabase_url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET').slice(0, 50),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
