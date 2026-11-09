import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const [{ data: identity, error: identityError }, { data: profile, error: profileError }, { data: school, error: schoolError }] = await Promise.all([
    admin.from('independent_learner_identities')
      .select('account_state,learner_email_verified_at,grade_label')
      .eq('user_id', user.id).maybeSingle(),
    admin.from('profiles').select('role,full_name,account_status,is_anonymized')
      .eq('id', user.id).maybeSingle(),
    admin.from('students').select('id').eq('profile_id', user.id).is('deleted_at', null).limit(1),
  ])
  if (identityError || profileError || schoolError || !profile) {
    return NextResponse.json({ error: 'Could not verify learner identity' }, { status: 503, headers })
  }
  if (!identity) return NextResponse.json({ kind: 'other' }, { headers })

  // These checks mirror the canonical restricted independent identity boundary.
  // No school record is created, and no school-scoped Twin authority is granted.
  if (identity.account_state !== 'restricted' || !identity.learner_email_verified_at ||
      !identity.grade_label || !user.email_confirmed_at ||
      profile.role !== null || profile.account_status !== 'active' ||
      profile.is_anonymized || (school?.length ?? 0) > 0) {
    return NextResponse.json({ error: 'Learner identity needs verification' }, { status: 403, headers })
  }
  return NextResponse.json({
    kind: 'independent',
    name: profile.full_name?.trim() || 'Learner',
    grade: identity.grade_label,
  }, { headers })
}
