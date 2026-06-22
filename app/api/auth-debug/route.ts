import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll()

  // Manually reassemble chunked sb- auth token
  const chunk0 = req.cookies.get('sb-yauqsxggtuxuykcbrtzf-auth-token.0')?.value ?? ''
  const chunk1 = req.cookies.get('sb-yauqsxggtuxuykcbrtzf-auth-token.1')?.value ?? ''
  const reassembled = chunk0 + chunk1

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = req.cookies.getAll().filter(
            c => !c.name.startsWith('sb-yauqsxggtuxuykcbrtzf-auth-token')
          )
          if (reassembled) {
            cookies.push({ name: 'sb-yauqsxggtuxuykcbrtzf-auth-token', value: reassembled })
          }
          return cookies
        },
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
      sb_cookies: allCookies.filter(c => c.name.startsWith('sb-')).map(c => ({ name: c.name, value_length: c.value.length })),
      reassembled_length: reassembled.length,
    },
    server_auth: {
      user_found: !!user,
      user_email: user?.email ?? null,
      error: error?.message ?? null,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
