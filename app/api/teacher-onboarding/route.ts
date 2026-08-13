import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: cookies => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const schoolId = typeof body.schoolId === 'string' ? body.schoolId : ''
    if (!schoolId) return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })

    const { error } = await supabase.rpc('connect_current_teacher_school', { p_school_id: schoolId })
    if (error) {
      if (error.message.includes('teacher_account_required')) return NextResponse.json({ error: 'Teacher account required' }, { status: 403 })
      if (error.message.includes('school_not_active')) return NextResponse.json({ error: 'School is not available for connection' }, { status: 409 })
      return NextResponse.json({ error: 'Unable to connect school' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId: user.id })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
