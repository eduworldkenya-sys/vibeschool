import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll()

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Reassemble chunked cookies
          const chunks: Record<string, string[]> = {}
          const normal: { name: string; value: string }[] = []

          for (const cookie of req.cookies.getAll()) {
            const match = cookie.name.match(/^(.+)\.(\d+)$/)
            if (match) {
              const base = match[1]
              const idx = parseInt(match[2])
              if (!chunks[base]) chunks[base] = []
              chunks[base][idx] = cookie.value
            } else {
              normal.push(cookie)
            }
          }

          const reassembled = Object.entries(chunks).map(([name, parts]) => ({
            name,
            value: parts.join(''),
          }))

          return [...normal, ...reassembled]
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
    sb_cookies: allCookies.filter(c => c.name.startsWith('sb-')).map(c => ({ name: c.name, length: c.value.length })),
    server_auth: {
      user_found: !!user,
      user_email: user?.email ?? null,
      error: error?.message ?? null,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
