import { NextRequest } from 'next/server'
import { field, object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { equalHash, hashSecret, token } from '@/lib/success-wishes/security'
import {
  sendSenderCode, senderChallengeHash, senderCode, senderEmail,
  senderFingerprint, senderVerificationReady,
} from '@/lib/success-wishes/verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function configuredSecret(): string {
  if (!senderVerificationReady()) throw new WishError(503, 'Email verification is not available yet.')
  return process.env.SUCCESS_WISHES_VERIFICATION_SECRET!
}

// Proof of email control, not an assertion that a sender is a legal guardian.
// No email address or verification code is saved in the database.
export async function POST(req: NextRequest) {
  try {
    const secret = configuredSecret()
    const input = object(await json(req))
    const email = senderEmail(input.email)
    const fingerprint = senderFingerprint(email, secret)
    await limit('sender-otp:global', 300, 3600)
    await limit('sender-otp:' + fingerprint, 3, 3600)
    const code = senderCode()
    const codeHash = senderChallengeHash(fingerprint, code, secret)
    const db = database()
    const { error } = await db.from('success_wishes_sender_challenges').upsert({
      email_digest: fingerprint, code_hash: codeHash,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      consumed_at: null, attempts: 0,
    }, { onConflict: 'email_digest' })
    if (error) throw error
    try {
      await sendSenderCode(email, code, { fingerprint })
    } catch {
      // Remove only the challenge created by this request: an overlapping
      // resend must not be accidentally invalidated by a late failure.
      await db.from('success_wishes_sender_challenges').delete()
        .eq('email_digest', fingerprint).eq('code_hash', codeHash)
      throw new WishError(503, 'We could not send a verification code. Please try again.')
    }
    return reply({ ok: true, message: 'Check your email for the six-digit code. It expires after ten minutes.' })
  } catch (error) { return failure(error) }
}

export async function PATCH(req: NextRequest) {
  try {
    const secret = configuredSecret()
    const input = object(await json(req))
    const email = senderEmail(input.email)
    const code = field(input.code, 6, 6)
    if (!/^\d{6}$/.test(code)) throw new WishError(400, 'Enter the six-digit code.')
    const fingerprint = senderFingerprint(email, secret)
    await limit('sender-verify:global', 1200, 3600)
    await limit('sender-verify:' + fingerprint, 12, 900)
    const db = database()
    const { data: challenge, error } = await db.from('success_wishes_sender_challenges')
      .select('code_hash,expires_at,attempts,consumed_at')
      .eq('email_digest',fingerprint).maybeSingle()
    if (error) throw error
    if (!challenge || challenge.consumed_at || challenge.attempts >= 5 ||
      Date.parse(challenge.expires_at) <= Date.now()) {
      throw new WishError(401, 'The verification code is invalid or expired.')
    }
    const matches = equalHash(challenge.code_hash,senderChallengeHash(fingerprint,code,secret))
    const { data: claimed, error: updateError } = await db.from('success_wishes_sender_challenges')
      .update({
        attempts: challenge.attempts + 1,
        consumed_at: matches ? new Date().toISOString() : null,
      })
      .eq('email_digest',fingerprint)
      .eq('code_hash',challenge.code_hash)
      .eq('attempts',challenge.attempts)
      .is('consumed_at',null)
      .gt('expires_at',new Date().toISOString())
      .select('email_digest').maybeSingle()
    if (updateError) throw updateError
    if (!claimed || !matches) throw new WishError(401, 'The verification code is invalid or expired.')
    const { data: sender, error: senderError } = await db.from('success_wishes_senders')
      .upsert({ email_digest: fingerprint }, { onConflict: 'email_digest' })
      .select('id').single()
    if (senderError || !sender) throw senderError || new Error('Verification could not be completed.')
    const proof = token()
    const expiresAt = new Date(Date.now()+24*60*60*1000).toISOString()
    const { error: proofError } = await db.from('success_wishes_sender_sessions')
      .insert({ token_hash:hashSecret(proof), sender_id: sender.id, expires_at: expiresAt })
    if (proofError) throw proofError
    return reply({ verified: true, senderProof: proof, expiresAt })
  } catch (error) { return failure(error) }
}
