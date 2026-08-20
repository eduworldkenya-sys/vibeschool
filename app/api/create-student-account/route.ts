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
    case 'not_found': return { error: 'Learner code not found. Ask your teacher for a new code.', status: 404 }
    case 'replaced': return { error: 'This learner code was replaced. Ask your teacher for the current code.', status: 410 }
    case 'already_claimed': return { error: 'A learner account already exists. Sign in instead.', status: 409 }
    case 'expired': return { error: 'This learner code has expired. Ask your teacher for a new one.', status: 410 }
    case 'student_not_found': return { error: 'Learner record not found.', status: 404 }
    case 'class_not_found': return { error: 'Current class enrollment could not be found.', status: 409 }
    case 'enrollment_conflict': return { error: 'Your school enrollment needs correction before this account can be created. Ask your teacher to review the learner record.', status: 409 }
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
    const password = typeof body.password === 'string' ? body.password : ''
    const claimCode = typeof body.claim_code === 'string' ? body.claim_code.trim().toUpperCase() : ''

    if (!/^\d{4,6}$/.test(password) || claimCode.length < 4) {
      return NextResponse.json({ error: 'Invalid learner setup details.' }, { status: 400 })
    }

    const { data: lookup, error: lookupError } = await adminSupabase.rpc('lookup_student_claim', { p_code: claimCode })
    if (lookupError || !lookup || typeof lookup !== 'object' || Array.isArray(lookup)) {
      return NextResponse.json({ error: 'Could not verify this learner code.' }, { status: 500 })
    }

    const status = typeof lookup.status === 'string' ? lookup.status : 'unknown'
    if (status !== 'ready') {
      const mapped = provisioningError(status)
      return NextResponse.json({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) }, { status: mapped.status })
    }

    if (!lookup.guardian_linked) {
      return NextResponse.json({
        error: 'A parent or guardian must connect to this learner before the learner account can be created.',
        code: 'guardian_required',
      }, { status: 403 })
    }

    const studentId = typeof lookup.student_id === 'string' ? lookup.student_id : ''
    const studentName = typeof lookup.student_name === 'string' ? lookup.student_name.trim() : ''
    const admission = typeof lookup.admission_number === 'string' && lookup.admission_number.trim()
      ? lookup.admission_number.trim().toLowerCase().replace(/\s/g, '')
      : studentId
    const schoolId = typeof lookup.school_id === 'string' ? lookup.school_id : ''

    if (!studentId || !studentName || !schoolId) {
      return NextResponse.json({ error: 'Learner identity setup is incomplete.' }, { status: 409 })
    }

    const { data: school } = await adminSupabase
      .from('schools')
      .select('id, subdomain')
      .eq('id', schoolId)
      .single()

    if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 })

    const internalEmail = `${safeSlug(school.subdomain || school.id)}_${admission}@vs.internal`

    const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: studentName },
    })

    if (createError || !created.user) {
      const message = createError?.message?.includes('already been registered')
        ? 'A learner account already exists. Sign in instead.'
        : (createError?.message || 'Could not create learner account.')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    createdUserId = created.user.id

    const { data: finalized, error: finalizeError } = await adminSupabase.rpc('finalize_student_provisioning', {
      p_code: claimCode,
      p_user_id: createdUserId,
      p_full_name: studentName,
    })

    if (finalizeError) throw finalizeError
    const finalizedStatus = finalized && typeof finalized === 'object' && !Array.isArray(finalized) && typeof finalized.status === 'string'
      ? finalized.status
      : null

    if (finalizedStatus !== 'success') {
      const mapped = provisioningError(finalizedStatus || 'unknown')
      await adminSupabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return NextResponse.json({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) }, { status: mapped.status })
    }

    return NextResponse.json({ user_id: createdUserId, email: internalEmail, student_name: studentName })
  } catch (e: unknown) {
    if (createdUserId) {
      try { await adminSupabase.auth.admin.deleteUser(createdUserId) } catch {}
    }
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
