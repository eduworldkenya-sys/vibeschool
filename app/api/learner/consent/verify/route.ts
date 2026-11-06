import { NextRequest } from 'next/server'
import {
  actor, adminClient, consentEnabled, createToken, json,
  readToken, recordEvent, sendConsentEmail, SITE, tokenHash,
} from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Verification is not available.' }, 503)
  try {
    const admin = adminClient()
    const learner = await actor(req, admin, 'student')
    if (!learner) return json({ error: 'Sign in as the learner.' }, 401)
    const input = await req.json()
    const code = readToken(input.token)
    const resend = input.resend === true
    if (!code && !resend) return json({ error: 'Invalid verification link.' }, 400)

    let requestId: string
    if (code) {
      const { data: confirmed, error } = await admin.from('learner_guardian_consent_requests')
        .update({
          learner_email_verified_at: new Date().toISOString(), learner_token_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_user_id', learner.id).eq('status', 'pending')
        .eq('learner_token_hash', tokenHash(code))
        .gt('learner_token_expires_at', new Date().toISOString())
        .is('learner_email_verified_at', null)
        .select('id').maybeSingle()
      if (error || !confirmed) return json({ error: 'This learner verification link has expired or was already used.' }, 410)
      requestId = confirmed.id
      await recordEvent(admin, requestId, 'learner_email_verified', 'one_time_email_link', learner.id)
    } else {
      const { data: pending, error } = await admin.from('learner_guardian_consent_requests')
        .select('id,guardian_invite_sent_at,updated_at')
        .eq('learner_user_id', learner.id).eq('status', 'pending')
        .not('learner_email_verified_at', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error || !pending) return json({ error: 'No verified learner email request found.' }, 404)
      if (pending.guardian_invite_sent_at &&
        Date.now() - new Date(pending.guardian_invite_sent_at).getTime() < 60 * 60 * 1000) {
        return json({ error: 'Approval email already sent. Check with your guardian or retry later.' }, 429)
      }
      if (Date.now() - new Date(pending.updated_at).getTime() < 60 * 1000) {
        return json({ error: 'Try again in a minute.' }, 429)
      }
      requestId = pending.id
    }

    const { data: pending, error: fetchError } = await admin.from('learner_guardian_consent_requests')
      .select('guardian_email,status,guardian_name')
      .eq('id', requestId).eq('learner_user_id', learner.id).eq('status', 'pending')
      .not('learner_email_verified_at', 'is', null).maybeSingle()
    if (fetchError || !pending) return json({ error: 'Consent request unavailable.' }, 409)

    const guardianToken = createToken()
    const now = new Date()
    const { error: tokenError } = await admin.from('learner_guardian_consent_requests')
      .update({
        token_hash: tokenHash(guardianToken),
        token_expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        updated_at: now.toISOString(),
      }).eq('id', requestId).eq('status', 'pending')
    if (tokenError) throw tokenError

    await sendConsentEmail(pending.guardian_email, 'Review a VibeSchool learner consent request',
      'A learner has provided your email address as their parent or guardian.\n\n'
      + 'This does not give the learner access to your account or any school records.\n'
      + 'If you are their parent or legal guardian, sign in with this email address, review the details and decide:\n\n'
      + SITE + '/guardian/consent?token=' + encodeURIComponent(guardianToken)
      + '\n\nThis link expires in 48 hours. Ignore this email if you do not recognize the request.')

    await admin.from('learner_guardian_consent_requests')
      .update({ guardian_invite_sent_at: new Date().toISOString() })
      .eq('id', requestId).eq('status', 'pending')
    return json({ ok: true, message: 'Your email is verified. Guardian approval has been requested.' })
  } catch {
    return json({ error: 'Verification saved, but guardian email delivery may need retrying.' }, 503)
  }
}
