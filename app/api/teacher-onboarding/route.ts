import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server credentials are not configured')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

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

    const admin = getAdminSupabase()
    const { data: profile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id,role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileLookupError) return NextResponse.json({ error: 'Unable to verify account' }, { status: 500 })
    if (!profile || profile.role !== 'teacher') return NextResponse.json({ error: 'Teacher account required' }, { status: 403 })

    const { data: school, error: schoolError } = await admin
      .from('schools')
      .select('id,status')
      .eq('id', schoolId)
      .maybeSingle()
    if (schoolError) return NextResponse.json({ error: 'Unable to verify school' }, { status: 500 })
    if (!school || school.status !== 'active') return NextResponse.json({ error: 'School is not available for connection' }, { status: 409 })

    const { error: memberErr } = await admin
      .from('school_members')
      .upsert({ profile_id: user.id, school_id: schoolId, role: 'teacher' }, { onConflict: 'school_id,profile_id', ignoreDuplicates: true })
    if (memberErr) return NextResponse.json({ error: 'Unable to connect school' }, { status: 500 })

    const { error: profileErr } = await admin
      .from('profiles')
      .update({ school_id: schoolId })
      .eq('id', user.id)
    if (profileErr) return NextResponse.json({ error: 'Unable to update school connection' }, { status: 500 })

    const { data: tp } = await admin.from('teacher_profiles').select('profile_id').eq('profile_id', user.id).maybeSingle()
    if (!tp) {
      const { error: teacherProfileErr } = await admin
        .from('teacher_profiles')
        .upsert({ profile_id: user.id, school_id: schoolId }, { onConflict: 'profile_id', ignoreDuplicates: true })
      if (teacherProfileErr) return NextResponse.json({ error: 'Unable to complete teacher profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
