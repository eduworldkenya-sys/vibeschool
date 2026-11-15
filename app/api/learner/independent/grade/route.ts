import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validLearnerGrade } from '@/lib/learner/independent-grade'
import { learnerDisplayName } from '@/lib/student/learner-welcome'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (process.env.INDEPENDENT_LEARNER_PUBLIC_GOOGLE_ENABLED !== 'true' ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  let input: unknown
  try { input = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const grade = (input as { grade?: unknown } | null)?.grade
  const submittedName = (input as { name?: unknown } | null)?.name
  if (!validLearnerGrade(grade)) return NextResponse.json({ error: 'Choose a valid grade' }, { status: 400 })
  if (submittedName !== undefined && (typeof submittedName !== 'string' || submittedName.length > 80)) {
    return NextResponse.json({ error: 'Enter a valid learner name' }, { status: 400 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7).trim())
  if (authError || !user || !user.email_confirmed_at) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: identity, error: lookupError } = await admin.from('independent_learner_identities')
    .select('account_state,learner_email_verified_at').eq('user_id', user.id).maybeSingle()
  if (lookupError || !identity || identity.account_state !== 'restricted' || !identity.learner_email_verified_at) {
    return NextResponse.json({ error: 'Independent learner identity not available' }, { status: 403 })
  }
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role,full_name,account_status,is_anonymized').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.role !== null || profile.account_status !== 'active' || profile.is_anonymized) {
    return NextResponse.json({ error: 'Learner account needs verification' }, { status: 403 })
  }
  const name = learnerDisplayName(submittedName, profile.full_name, user.user_metadata?.full_name, user.user_metadata?.name)
  if (!name || name.length < 2 || name.length > 80 || !new RegExp(String.raw`^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'’-]*import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validLearnerGrade } from '@/lib/learner/independent-grade'
import { learnerDisplayName } from '@/lib/student/learner-welcome'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (process.env.INDEPENDENT_LEARNER_PUBLIC_GOOGLE_ENABLED !== 'true' ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  let input: unknown
  try { input = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const grade = (input as { grade?: unknown } | null)?.grade
  const submittedName = (input as { name?: unknown } | null)?.name
  if (!validLearnerGrade(grade)) return NextResponse.json({ error: 'Choose a valid grade' }, { status: 400 })
  if (submittedName !== undefined && (typeof submittedName !== 'string' || submittedName.length > 80)) {
    return NextResponse.json({ error: 'Enter a valid learner name' }, { status: 400 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7).trim())
  if (authError || !user || !user.email_confirmed_at) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: identity, error: lookupError } = await admin.from('independent_learner_identities')
    .select('account_state,learner_email_verified_at').eq('user_id', user.id).maybeSingle()
  if (lookupError || !identity || identity.account_state !== 'restricted' || !identity.learner_email_verified_at) {
    return NextResponse.json({ error: 'Independent learner identity not available' }, { status: 403 })
  }
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role,full_name,account_status,is_anonymized').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.role !== null || profile.account_status !== 'active' || profile.is_anonymized) {
    return NextResponse.json({ error: 'Learner account needs verification' }, { status: 403 })
  }
  const name = learnerDisplayName(submittedName, profile.full_name, user.user_metadata?.full_name, user.user_metadata?.name)
, 'u').test(name)) {
    return NextResponse.json({ error: 'Enter your name to continue' }, { status: 400 })
  }
  if (profile.full_name !== name) {
    const { error: nameError } = await admin.from('profiles').update({ full_name: name })
      .eq('id', user.id).is('role', null)
    if (nameError) return NextResponse.json({ error: 'Could not save your name. Try again.' }, { status: 503 })
  }
  const { error } = await admin.from('independent_learner_identities')
    .update({ grade_label: grade, updated_at: new Date().toISOString() }).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not save grade' }, { status: 503 })
  // Provision the same personal student identity used by every learning engine.
  // This service-only RPC verifies the account and rejects school conflicts.
  const { data: studentId, error: provisioningError } = await admin.rpc('ensure_independent_learner_student', { p_user_id: user.id })
  if (provisioningError || !studentId) {
    return NextResponse.json({ error: 'Could not prepare learner account. Please retry.' }, { status: 409 })
  }
  const { error: studentNameError } = await admin.from('students').update({ name })
    .eq('id', studentId).eq('profile_id', user.id).is('deleted_at', null)
  if (studentNameError) return NextResponse.json({ error: 'Could not finish learner profile. Please retry.' }, { status: 503 })
  return NextResponse.json({ saved: true })
}
