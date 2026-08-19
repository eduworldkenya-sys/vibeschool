import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server credentials are not configured')

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function safeSlug(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  return slug || 'vs'
}

function provisioningError(status: string) {
  switch (status) {
    case 'not_found': return { error: 'Claim code not found.', status: 404 }
    case 'already_claimed': return { error: 'A learner account already exists. Sign in instead.', status: 409 }
    case 'expired': return { error: 'This claim code has expired. Ask your teacher for a new one.', status: 410 }
    case 'student_not_found': return { error: 'Learner record not found.', status: 404 }
    case 'guardian_required': return { error: 'A parent or guardian must connect to this learner before the learner account can be created.', status: 403, code: 'guardian_required' }
    case 'school_not_found': return { error: 'School assignment not found.', status: 409 }
    case 'profile_missing': return { error: 'Learner identity setup is incomplete.', status: 409 }
    case 'profile_role_conflict': return { error: 'This identity is already assigned to another account type.', status: 409 }
    default: return { error: 'Could not finish learner account setup.', status: 500 }
  }
}

export async function POST(req: NextRequest) {
  const adminSupabase = getAdminSupabase()
  let createdUserId: string | null = null

  try {
    const body = await req.json()
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const claimCode = typeof body.claim_code === 'string' ? body.claim_code.trim().toUpperCase() : ''

    if (fullName.length < 2 || !/^\d{4,6}$/.test(password) || claimCode.length < 4) {
      return NextResponse.json({ error: 'Invalid learner setup details.' }, { status: 400 })
    }

    const { data: claim, error: claimError } = await adminSupabase
      .from('student_claim_codes')
      .select('student_id, claimed, expires_at, role')
      .eq('code', claimCode)
      .eq('role', 'student')
      .maybeSingle()

    if (claimError || !claim) return NextResponse.json({ error: 'Claim code not found.' }, { status: 404 })
    if (claim.claimed) return NextResponse.json({ error: 'This claim code has already been used.' }, { status: 409 })
    if (claim.expires_at && new Date(claim.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This claim code has expired. Ask your teacher for a new one.' }, { status: 410 })
    }
    if (!claim.student_id) return NextResponse.json({ error: 'The learner record is incomplete.' }, { status: 409 })

    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, admission_number, class_id, parent_linked_at, profile_id, deleted_at')
      .eq('id', claim.student_id)
      .single()

    if (studentError || !student || student.deleted_at) return NextResponse.json({ error: 'Learner record not found.' }, { status: 404 })
    if (student.profile_id) return NextResponse.json({ error: 'A learner account already exists. Sign in instead.' }, { status: 409 })
    if (!student.parent_linked_at) {
      return NextResponse.json({
        error: 'A parent or guardian must connect to this learner before the learner account can be created.',
        code: 'guardian_required',
      }, { status: 403 })
    }

    if (!student.class_id) return NextResponse.json({ error: 'The learner is not assigned to a class.' }, { status: 409 })

    const { data: klass, error: classError } = await adminSupabase
      .from('classes')
      .select('school_id')
      .eq('id', student.class_id)
      .single()

    if (classError || !klass?.school_id) return NextResponse.json({ error: 'School assignment not found.' }, { status: 409 })

    // A historical/revoked parent link must not satisfy the guardian gate.
    // Bind the relationship to the learner's current school and require active access.
    const { data: parentLink } = await adminSupabase
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', student.id)
      .eq('school_id', klass.school_id)
      .neq('access_level', 'none')
      .limit(1)
      .maybeSingle()

    if (!parentLink?.parent_id) {
      return NextResponse.json({
        error: 'The parent or guardian connection is incomplete. Ask your teacher to resend the parent link.',
        code: 'guardian_required',
      }, { status: 403 })
    }

    const { data: school } = await adminSupabase
      .from('schools')
      .select('id, subdomain')
      .eq('id', klass.school_id)
      .single()

    if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 })

    const admission = (student.admission_number || student.id).toLowerCase().replace(/\s/g, '')
    const internalEmail = `${safeSlug(school.subdomain || school.id)}_${admission}@vs.internal`

    const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError || !created.user) {
      const message = createError?.message.includes('already been registered')
        ? 'A learner account already exists. Sign in instead.'
        : (createError?.message || 'Could not create learner account.')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    createdUserId = created.user.id

    const { data: finalized, error: finalizeError } = await adminSupabase.rpc('finalize_student_provisioning', {
      p_code: claimCode,
      p_user_id: createdUserId,
      p_full_name: fullName,
    })

    if (finalizeError) throw finalizeError
    const status = finalized && typeof finalized === 'object' && !Array.isArray(finalized) && typeof finalized.status === 'string'
      ? finalized.status
      : null

    if (status !== 'success') {
      const mapped = provisioningError(status || 'unknown')
      await adminSupabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) }, { status: mapped.status })
    }

    return NextResponse.json({ user_id: createdUserId, email: internalEmail })
  } catch (e: unknown) {
    if (createdUserId) {
      try { await adminSupabase.auth.admin.deleteUser(createdUserId) } catch {}
    }
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
