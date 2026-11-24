import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validLearnerGrade } from '@/lib/learner/independent-grade'
import { resolveRegistrationLearningSelection } from '@/lib/learner/learning-levels'
import { learnerDisplayName } from '@/lib/student/learner-welcome'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (process.env.INDEPENDENT_LEARNER_PUBLIC_GOOGLE_ENABLED !== 'true' ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  let input: unknown
  try { input = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const payload = input as { grade?: unknown; level?: unknown; choice?: unknown; name?: unknown; ageBand?: unknown } | null
  // Adult learners sign up directly. Under-18 learners use a guardian-created
  // account, not a self-declared school enrollment or an unverified adult role.
  if (payload?.ageBand !== 'adult') return NextResponse.json({ error: 'A verified adult can set up this private learner account. You can still read lessons in Learn.' }, { status: 403 })
  const selected = resolveRegistrationLearningSelection(payload?.level, payload?.choice)
  // Keep the historic grade-only API contract for registered school-level accounts.
  const grade = selected?.gradeLabel ?? (validLearnerGrade(payload?.grade) ? payload.grade : null)
  const submittedName = payload?.name
  if (!grade || ((payload?.level !== undefined || payload?.choice !== undefined) && !selected))
    return NextResponse.json({ error: 'Choose a valid learning level and programme' }, { status: 400 })
  if (submittedName !== undefined && (typeof submittedName !== 'string' || submittedName.length > 80)) {
    return NextResponse.json({ error: 'Enter a valid learner name' }, { status: 400 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7).trim())
  if (authError || !user || !user.email_confirmed_at) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: identity, error: lookupError } = await admin.from('independent_learner_identities')
    .select('account_state,learner_email_verified_at,grade_label,age_band').eq('user_id', user.id).maybeSingle()
  if (lookupError || !identity || identity.account_state !== 'restricted' || !identity.learner_email_verified_at || identity.age_band === 'under_18') {
    return NextResponse.json({ error: 'Independent learner identity not available' }, { status: 403 })
  }
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role,full_name,account_status,is_anonymized,date_of_birth').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.role !== null || profile.account_status !== 'active' || profile.is_anonymized) {
    return NextResponse.json({ error: 'Learner account needs verification' }, { status: 403 })
  }
  // A known minor may never be promoted by a checkbox. A date of birth
  // already stored on the verified profile overrides the self-declaration.
  if (profile.date_of_birth) {
    const dob = new Date(profile.date_of_birth + 'T00:00:00Z')
    const today = new Date()
    const birthday = new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate()))
    if (Number.isNaN(dob.getTime()) || dob > birthday) {
      return NextResponse.json({ error: 'This learner requires age-appropriate account setup.' }, { status: 403 })
    }
  }
  // This table intentionally grants only user-owned RLS access, not service_role
  // table privileges. Forward the verified bearer token for reads and writes.
  const pathwayClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    },
  )
  // Never silently discard or reassign an established professional pathway.
  const { data: existingPath, error: pathLookupError } = await pathwayClient.from('learner_education_paths')
    .select('education_stage,programme_family,qualification_code').eq('user_id', user.id).maybeSingle()
  if (pathLookupError) return NextResponse.json({ error: 'Study pathway check unavailable' }, { status: 503 })
  if (existingPath && (!selected?.pathway || existingPath.education_stage !== 'post_secondary' ||
      existingPath.programme_family !== selected.pathway.programme_family ||
      existingPath.qualification_code !== selected.pathway.qualification_code)) {
    return NextResponse.json({ error: 'Your existing study pathway must be changed in your profile' }, { status: 409 })
  }
  const restoreGrade = async () => {
    await admin.from('independent_learner_identities')
      .update({ grade_label: identity.grade_label, age_band: identity.age_band, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('grade_label', grade)
  }
  const name = learnerDisplayName(submittedName, profile.full_name, user.user_metadata?.full_name, user.user_metadata?.name)
  if (!name || name.length < 2 || name.length > 80 || !new RegExp(String.raw`^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'’-]*$`, 'u').test(name)) {
    return NextResponse.json({ error: 'Enter your name to continue' }, { status: 400 })
  }
  if (profile.full_name !== name) {
    const { error: nameError } = await admin.from('profiles').update({ full_name: name })
      .eq('id', user.id).is('role', null)
    if (nameError) return NextResponse.json({ error: 'Could not save your name. Try again.' }, { status: 503 })
  }
  const { error } = await admin.from('independent_learner_identities')
    .update({ grade_label: grade, age_band: 'adult', updated_at: new Date().toISOString() }).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not save grade' }, { status: 503 })
  // Provision the same personal student identity used by every learning engine.
  // This service-only RPC verifies the account and rejects school conflicts.
  const { data: studentId, error: provisioningError } = await admin.rpc('ensure_independent_learner_student', { p_user_id: user.id })
  if (provisioningError || !studentId) {
    await restoreGrade()
    return NextResponse.json({ error: 'Could not prepare learner account. Please retry.' }, { status: 409 })
  }
  const { error: studentNameError } = await admin.from('students').update({ name })
    .eq('id', studentId).eq('profile_id', user.id).is('deleted_at', null)
  if (studentNameError) {
    await restoreGrade()
    return NextResponse.json({ error: 'Could not finish learner profile. Please retry.' }, { status: 503 })
  }
  if (selected?.pathway && !existingPath) {
    const { error: pathwayError } = await pathwayClient.from('learner_education_paths').insert({
      user_id: user.id,
      education_stage: 'post_secondary',
      ...selected.pathway,
    })
    if (pathwayError) {
      await restoreGrade()
      return NextResponse.json({ error: 'Could not save professional study pathway. Please retry.' }, { status: 503 })
    }
  }
  return NextResponse.json({ saved: true, destination: selected?.pathway ? '/student/college' : '/student' })
}
