import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { learnerDisplayName } from '@/lib/student/learner-welcome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization') ?? ''
  if (!bearer.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401, headers })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Account check temporarily unavailable' }, { status: 503, headers })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await admin.auth.getUser(bearer.slice(7).trim())
  if (authError || !user) return NextResponse.json({ error: 'Sign in again' }, { status: 401, headers })

  // profile_entitlements has learner-scoped SELECT; service_role deliberately has no SELECT grant.
  // Forward the authenticated user's JWT for an RLS-authorized entitlement read.
  // Any failure hides QA only; normal learner sign-in must continue.
  const qaClient = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: bearer } },
    })
    : null
  const [{ data: identity, error: identityError }, { data: profile, error: profileError }, { data: school, error: schoolError }, { data: qaGrant, error: qaError }] = await Promise.all([
    admin.from('independent_learner_identities')
      .select('account_state,learner_email_verified_at,grade_label,age_band')
      .eq('user_id', user.id).maybeSingle(),
    admin.from('profiles').select('role,full_name,account_status,is_anonymized')
      .eq('id', user.id).maybeSingle(),
    admin.from('students').select('id,class_id,name').eq('profile_id', user.id).is('deleted_at', null).limit(2),
    qaClient ? qaClient.from('profile_entitlements').select('entitlement_key,source,granted_until')
      .eq('profile_id', user.id).eq('entitlement_key', 'qa_universal_learner').maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (identityError || profileError || schoolError || !profile) {
    return NextResponse.json({ error: 'Could not verify learner identity' }, { status: 503, headers })
  }
  // This flag enables only QA navigation. It NEVER changes school enrollment,
  // teacher authority, assignment eligibility, RLS or the learner's real grade.
  const universalTest = !qaError && !!qaGrant && qaGrant.source === 'owner_qa' &&
    (!qaGrant.granted_until || Date.parse(qaGrant.granted_until) > Date.now()) &&
    profile.account_status === 'active' && !profile.is_anonymized &&
    (school?.length ?? 0) === 1 && !!user.email_confirmed_at &&
    (profile.role === 'student' || profile.role === null)
  if (!identity) return NextResponse.json({ kind: 'other', universalTest }, { headers })
  // A verified later school link takes the standard student/Twin path.
  if (profile.role === 'student') return NextResponse.json({
    kind: 'other', universalTest,
    // Only an un-enrolled, guardian-managed student needs this grade fallback.
    // A later verified school enrollment remains authoritative.
    grade: identity.age_band === 'under_18' && identity.account_state === 'restricted' &&
      (school?.length ?? 0) === 1 && !school?.[0]?.class_id ? identity.grade_label : undefined,
  }, { headers })

  // These checks mirror the canonical restricted independent identity boundary.
  // No school record is created, and no school-scoped Twin authority is granted.
  if (identity.account_state !== 'restricted' || !identity.learner_email_verified_at ||
      !identity.grade_label || !user.email_confirmed_at ||
      profile.role !== null || profile.account_status !== 'active' ||
      profile.is_anonymized || (school?.length ?? 0) !== 1 ||
      !!school?.[0]?.class_id) {
    return NextResponse.json({ error: 'Learner identity needs verification' }, { status: 403, headers })
  }
  return NextResponse.json({
    kind: 'independent',
    name: learnerDisplayName(profile.full_name, school?.[0]?.name, user.user_metadata?.full_name, user.user_metadata?.name),
    grade: identity.grade_label,
    studentId: school![0].id,
    universalTest,
  }, { headers })
}
