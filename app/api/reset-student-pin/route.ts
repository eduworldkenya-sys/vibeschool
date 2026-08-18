import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = getAdminSupabase()
    const { student_auth_id, new_pin } = await req.json()

    if (!student_auth_id || !new_pin) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (!/^\d{4,6}$/.test(String(new_pin))) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the caller-supplied auth id to the canonical learner before using
    // the service-role Admin API. Knowing/guessing an auth UUID gives no authority.
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, profile_id, deleted_at')
      .eq('profile_id', String(student_auth_id))
      .is('deleted_at', null)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 })
    }

    const { data: currentClasses, error: classError } = await adminSupabase
      .from('student_classes')
      .select('school_id, class_id')
      .eq('student_id', student.id)
      .eq('is_current', true)

    if (classError || !currentClasses?.length) {
      return NextResponse.json({ error: 'Learner has no current school/class assignment' }, { status: 409 })
    }

    const schoolIds = [...new Set(currentClasses.map((row) => row.school_id).filter(Boolean))]
    const classIds = [...new Set(currentClasses.map((row) => row.class_id).filter(Boolean))]

    const [{ data: teacherAssignments }, { data: adminMemberships }] = await Promise.all([
      adminSupabase
        .from('teacher_classes')
        .select('school_id, class_id')
        .eq('teacher_id', user.id)
        .in('class_id', classIds),
      adminSupabase
        .from('school_members')
        .select('school_id, role')
        .eq('profile_id', user.id)
        .in('school_id', schoolIds)
        .in('role', ['admin', 'owner']),
    ])

    const teacherAuthorized = (teacherAssignments ?? []).some((assignment) =>
      currentClasses.some((studentClass) =>
        assignment.school_id === studentClass.school_id &&
        assignment.class_id === studentClass.class_id
      )
    )
    const adminAuthorized = (adminMemberships ?? []).some((membership) =>
      schoolIds.includes(membership.school_id)
    )

    if (!teacherAuthorized && !adminAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: resetErr } = await adminSupabase.auth.admin.updateUserById(
      String(student_auth_id),
      { password: String(new_pin) }
    )

    if (resetErr) {
      return NextResponse.json({ error: 'Could not reset learner PIN' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 },
    )
  }
}
