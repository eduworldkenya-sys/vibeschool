import { NextRequest } from 'next/server'
import {
  adminClient, consentEnabled, CONSENT_PURPOSE, CONSENT_VERSION,
  inviteGuardian, learnerConsentActor,
  createToken, json, recordEvent, sendConsentEmail, SITE, tokenHash, validEmail,
} from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!consentEnabled()) return json({ enabled: false }, 503)
  try {
    const admin = adminClient()
    const learner = await learnerConsentActor(req, admin)
    if (!learner) return json({ error: 'Sign in as a learner.' }, 401)
    const { user, independent } = learner
    const requests = admin.from('learner_guardian_consent_requests')
      .select('id,status,learner_email,learner_email_verified_at,guardian_email,guardian_invite_sent_at,created_at,approved_at')
      .eq('learner_user_id', user.id)
    if (independent) requests.is('student_id', null).eq('learner_email', learner.email)
    else requests.not('student_id', 'is', null)
    const { data, error } = await requests.order('created_at', { ascending: false }).limit(1).maybeSingle()
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
    const learner = await learnerConsentActor(req, admin)
    if (!learner) return json({ error: 'Sign in as a learner.' }, 401)
    const { user, independent } = learner
    const body = await req.json()
    const learnerEmail = independent ? learner.email : validEmail(body.learner_email)
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

    let studentId: string | null = null
    if (!independent) {
      const { data: schoolLearner, error: learnerError } = await admin.from('students')
        .select('id').eq('profile_id', user.id).is('deleted_at', null).maybeSingle()
      if (learnerError) throw learnerError
      if (!schoolLearner) return json({ error: 'A school learner identity is required for this flow.' }, 403)
      studentId = schoolLearner.id
    }

    // Expire abandoned challenges before checking the single-active-request rule.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { error: expireError } = await admin.from('learner_guardian_consent_requests')
      .update({ status: 'expired', token_hash: null, learner_token_hash: null, updated_at: new Date().toISOString() })
      .eq('learner_user_id', user.id).eq('status', 'pending').lt('created_at', cutoff)
    if (expireError) throw expireError
    const { data: active, error: activeError } = await admin.from('learner_guardian_consent_requests')
      .select('id').eq('learner_user_id', user.id)
      .in('status', ['pending', 'approved']).limit(1).maybeSingle()
    if (activeError) throw activeError
    if (active) return json({ error: 'A verification request is already pending or approved.' }, 409)

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

    const token = independent ? null : createToken()
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const { data: created, error: createError } = await admin.from('learner_guardian_consent_requests')
      .insert({
        learner_user_id: user.id, student_id: studentId,
        learner_email: learnerEmail, guardian_name: name,
        guardian_email: guardianEmail, guardian_relationship: relationship,
        consent_purpose: CONSENT_PURPOSE, policy_version: CONSENT_VERSION,
        learner_email_verified_at: independent ? new Date().toISOString() : null,
        learner_token_hash: token ? tokenHash(token) : null, learner_token_expires_at: token ? expires : null,
        status: 'pending',
      }).select('id,updated_at').single()
    if (createError || !created) throw createError ?? new Error('Failed to create verification request')

    if (independent) {
      try {
        await recordEvent(admin, created.id, 'requested', 'verified_google_signup', user.id)
        await recordEvent(admin, created.id, 'learner_email_verified', 'verified_google_identity', user.id)
      } catch {
        await admin.from('learner_guardian_consent_requests').update({ status: 'review_required' })
          .eq('id', created.id).eq('status', 'pending')
        return json({ error: 'Could not record the verification request.' }, 503)
      }
      try {
        await inviteGuardian(admin, created.id, user.id, created.updated_at)
        return json({ ok: true, status: 'pending', message: 'Guardian approval requested.' }, 201)
      } catch {
        return json({ ok: true, status: 'pending', message: 'Request saved. You can resend the guardian email in a minute.' }, 201)
      }
    }

    if (!token) throw new Error('Missing learner email challenge')
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
