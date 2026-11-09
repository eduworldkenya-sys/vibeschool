import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validLearnerGrade } from '@/lib/learner/independent-grade'

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
  if (!validLearnerGrade(grade)) return NextResponse.json({ error: 'Choose a valid grade' }, { status: 400 })
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
  const { error } = await admin.from('independent_learner_identities')
    .update({ grade_label: grade, updated_at: new Date().toISOString() }).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not save grade' }, { status: 503 })
  // Provision the same personal student identity used by every learning engine.
  // This service-only RPC verifies the account and rejects school conflicts.
  const { data: studentId, error: provisioningError } = await admin.rpc('ensure_independent_learner_student', { p_user_id: user.id })
  if (provisioningError || !studentId) {
    return NextResponse.json({ error: 'Could not prepare learner account. Please retry.' }, { status: 409 })
  }
  return NextResponse.json({ saved: true })
}
