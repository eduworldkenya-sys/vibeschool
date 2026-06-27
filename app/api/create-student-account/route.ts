import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name } = await req.json()
    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user_id: data.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 })
  }
}
