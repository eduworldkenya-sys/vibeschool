import { NextRequest } from 'next/server'
import {
  actor, adminClient, consentEnabled, CONSENT_PURPOSE, CONSENT_VERSION,
  createToken, json, recordEvent, sendConsentEmail, SITE, tokenHash, validEmail,
} from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!consentEnabled()) return json({ enabled: false }, 503)
  try {
    const admin = adminClient()
    const user = await actor(req, admin, 'student')
    if (!user) return json({ error: 'Sign in as a learner.' }, 401)
    const { data, error } = await admin.from('learner_guardian_consent_requests')
      .select('id,status,learner_email,learner_email_verified_at,guardian_email,guardian_invite_sent_at,created_at,approved_at')
      .eq('learner_user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    return json({ enabled: true, request: data })
  } catch {
    return json({ error: 'Could not load verification status.' }, 500)
  }
}

export async function POST(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Verification is not available yet.' }, 503)
  try {
    const admin = adminClient()
    const user = await actor(req, admin, 'student')
    if (!user) return json({ error: 'Sign in as a learner.' }, 401)
    const body = await req.json()
    const learnerEmail = validEmail(body.learner_email)
    const guardianEmail = validEmail(body.guardian_email)
    const name = typeof body.guardian_name === 'string' ? body.guardian_name.trim().replace(/\s+/g, ' ') : ''
    const relationship = typeof body.guardian_relationship === 'string' ? body.guardian_relationship : ''
    const allowedRelations = ['mother', 'father', 'legal_guardian', 'other_guardian']
    if (!learnerEmail || !guardianEmail || learnerEmail === guardianEmail ||
        !name || name.length > 100 || !allowedRelations.includes(relationship) ||
        body.acknowledge_processing !== true) {
      return json({ error: 'Enter different, valid learner and guardian emails and the guardian details.' }, 400)
    }
    if (learnerEmail.endsWith('@vs.internal') || guardianEmail.endsWith('@vs.internal')) {
      return json({ error: 'Use real email addresses.' }, 400)
    }

    const { data: schoolLearner } = await admin.from('students')
      .select('id').eq('profile_id', user.id).limit(1).maybeSingle()
    if (!schoolLearner) return json({ error: 'A school learner identity is required for this flow.' }, 403)

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: limitError } = await admin.from('learner_guardian_consent_requests')
      .select('id', { count: 'exact', head: true })
      .eq('learner_user_id', user.id).gte('created_at', since)
    if (limitError) throw limitError
    if ((count ?? 0) >= 3) return json({ error: 'Daily request limit reached. Try again tomorrow.' }, 429)

    const { count: guardianCount, error: guardianLimitError } = await admin
      .from('learner_guardian_consent_requests')
      .select('id', { count: 'exact', head: true })
      .eq('guardian_email', guardianEmail).gte('created_at', since)
    if (guardianLimitError) throw guardianLimitError
    if ((guardianCount ?? 0) >= 10) return json({ error: 'Too many requests for this email. Try later.' }, 429)

    const token = createToken()
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const { data: created, error: createError } = await admin.from('learner_guardian_consent_requests')
      .insert({
        learner_user_id: user.id, student_id: schoolLearner.id,
        learner_email: learnerEmail, guardian_name: name,
        guardian_email: guardianEmail, guardian_relationship: relationship,
        consent_purpose: CONSENT_PURPOSE, policy_version: CONSENT_VERSION,
        learner_token_hash: tokenHash(token), learner_token_expires_at: expires,
        status: 'pending',
      }).select('id').single()
    if (createError || !created) throw createError ?? new Error('Failed to create verification request')

    try {
      await sendConsentEmail(learnerEmail, 'Verify your VibeSchool learner email',
        'Open this link while signed in to your learner account to verify your email:\n\n'
        + SITE + '/student/guardian-consent?verify=' + encodeURIComponent(token)
        + '\n\nThis link expires in 30 minutes. Do not share it.')
    } catch {
      // An unsent challenge cannot lead to guardian approval.
      await admin.from('learner_guardian_consent_requests')
        .update({ status: 'review_required', learner_token_hash: null, token_hash: null })
        .eq('id', created.id).eq('status', 'pending')
      return json({ error: 'We could not deliver the verification email. Please try later.' }, 503)
    }
    await recordEvent(admin, created.id, 'requested', 'signed_in_learner_email_challenge', user.id)
    return json({ ok: true, status: 'pending', message: 'Check your learner email to verify it.' }, 201)
  } catch {
    return json({ error: 'Could not start verification.' }, 500)
  }
}
