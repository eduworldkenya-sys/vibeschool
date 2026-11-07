import { NextRequest } from 'next/server'
import {
  adminClient, consentEnabled, inviteGuardian, json, learnerConsentActor,
  readToken, recordEvent, tokenHash,
} from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Verification is not available.' }, 503)
  try {
    const admin = adminClient()
    const learner = await learnerConsentActor(req, admin)
    if (!learner) return json({ error: 'Sign in as the learner.' }, 401)
    const { user, independent } = learner
    const input = await req.json()
    const code = independent ? null : readToken(input.token)
    const resend = input.resend === true
    if (!code && !resend) return json({ error: 'Invalid verification link.' }, 400)

    let requestId: string
    let updatedAt: string
    if (code) {
      const { data: confirmed, error } = await admin.from('learner_guardian_consent_requests')
        .update({
          learner_email_verified_at: new Date().toISOString(), learner_token_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_user_id', user.id).eq('status', 'pending')
        .not('student_id', 'is', null)
        .eq('learner_token_hash', tokenHash(code))
        .gt('learner_token_expires_at', new Date().toISOString())
        .is('learner_email_verified_at', null)
        .select('id,updated_at').maybeSingle()
      if (error || !confirmed) return json({ error: 'This learner verification link has expired or was already used.' }, 410)
      requestId = confirmed.id
      updatedAt = confirmed.updated_at
      await recordEvent(admin, requestId, 'learner_email_verified', 'one_time_email_link', user.id)
    } else {
      const requests = admin.from('learner_guardian_consent_requests')
        .select('id,guardian_invite_sent_at,updated_at')
        .eq('learner_user_id', user.id).eq('status', 'pending')
        .not('learner_email_verified_at', 'is', null)
      if (independent) requests.is('student_id', null).eq('learner_email', learner.email)
      else requests.not('student_id', 'is', null)
      const { data: pending, error } = await requests.order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error || !pending) return json({ error: 'No verified learner email request found.' }, 404)
      if (pending.guardian_invite_sent_at &&
        Date.now() - new Date(pending.guardian_invite_sent_at).getTime() < 60 * 60 * 1000) {
        return json({ error: 'Approval email already sent. Check with your guardian or retry later.' }, 429)
      }
      if (Date.now() - new Date(pending.updated_at).getTime() < 60 * 1000) {
        return json({ error: 'Try again in a minute.' }, 429)
      }
      requestId = pending.id
      updatedAt = pending.updated_at
    }

    await inviteGuardian(admin, requestId, user.id, updatedAt)
    return json({ ok: true, message: 'Your email is verified. Guardian approval has been requested.' })
  } catch {
    return json({ error: 'Verification saved, but guardian email delivery may need retrying.' }, 503)
  }
}
