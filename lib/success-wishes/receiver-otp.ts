import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from './contracts'
import { takeAttempt } from './server'
import { receiverDatabase } from './receiver'
import { hashSecret } from './security'
import { newSixCharacterRecoveryCode } from './recovery-code'
import { hashedPhoneRateKey, newOtp, otpDigest, recoveryDigest, sendReceiverSms } from './receiver-sms'

export const INBOX_COOKIE = 'vs_wishes_receiver'
export const INBOX_AGE_SECONDS = 24 * 60 * 60
type DB = ReturnType<typeof receiverDatabase>
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export function inboxDigest(secret: string) {
  return hashSecret('success-wishes:receiver-inbox:' + secret)
}
export function inboxCookie(req: NextRequest, age: number) {
  return { httpOnly: true as const, sameSite: 'strict' as const,
    secure: req.nextUrl.protocol === 'https:', path: '/api/success-wishes/receiver', maxAge: age }
}
export type OtpPurpose = 'recovery' | 'consent_adult' | 'consent_guardian' | 'withdraw_adult' | 'withdraw_guardian'
export async function issueOtp(db: DB, receiverId: string, phone: string, purpose: OtpPurpose = 'recovery') {
  await takeAttempt(db, 'receiver-otp-cooldown:' + receiverId, 1, 60)
  await takeAttempt(db, 'receiver-otp:global', 1000, 86400)
  await takeAttempt(db, 'receiver-otp:' + hashedPhoneRateKey(phone), 5, 86400)
  const otp = newOtp()
  const { data: challenge, error } = await db.from('success_wish_receiver_challenges').insert({
    receiver_id: receiverId, purpose, code_hash: otpDigest(receiverId, otp),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }).select('id').single()
  if (error || !challenge) throw new WishError(503, 'Could not begin phone verification.')
  const { data: delivery, error: deliveryError } = await db.from('success_wish_sms_deliveries')
    .insert({ receiver_id: receiverId, purpose, status: 'queued' }).select('id').single()
  if (deliveryError || !delivery) throw new WishError(503, 'Could not queue verification SMS.')
  try {
    const action = purpose.startsWith('withdraw_') ? 'WITHDRAW consent and close the inbox' : purpose.startsWith('consent_') ? 'APPROVE receiving and storing wishes' : 'OPEN your private inbox'
    const result = await sendReceiverSms(phone, 'VibeSchool: Code ' + otp + ' to ' + action + '. Expires in 5 minutes. Do not share it.', process.env, purpose.startsWith('withdraw_'))
    await db.from('success_wish_sms_deliveries').update({ status: 'accepted', provider_id: result.providerId, updated_at: new Date().toISOString() }).eq('id', delivery.id)
  } catch (error) {
    await db.from('success_wish_sms_deliveries').update({ status: 'failed', failure_code: 'submission_failed', updated_at: new Date().toISOString() }).eq('id', delivery.id)
    await db.from('success_wish_receiver_challenges').delete().eq('id', challenge.id)
    throw error
  }
  return challenge.id as string
}
export async function consumeOtp(db: DB, receiverId: string, challengeId: unknown, code: unknown, purpose: OtpPurpose = 'recovery') {
  if (typeof challengeId !== 'string' || !UUID.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code))
    throw new WishError(401, 'Check the verification code and try again.')
  await takeAttempt(db, 'receiver-otp-verify:' + receiverId, 18, 900)
  const { data, error } = await db.rpc('success_wish_consume_receiver_challenge', {
    p_challenge: challengeId, p_receiver: receiverId, p_digest: otpDigest(receiverId, code), p_purpose: purpose,
  })
  if (error) throw new WishError(503, 'Could not verify your code.')
  if (data !== true) throw new WishError(401, 'Incorrect or expired code.')
}
export async function createInboxSession(db: DB, req: NextRequest, receiverId: string) {
  const raw = randomBytes(32).toString('hex')
  const { error } = await db.from('success_wish_receiver_sessions').insert({
    token_hash: inboxDigest(raw), receiver_id: receiverId,
    expires_at: new Date(Date.now() + INBOX_AGE_SECONDS * 1000).toISOString(),
  })
  if (error) throw new WishError(503, 'Could not save your private inbox session.')
  return { token: raw, options: inboxCookie(req, INBOX_AGE_SECONDS) }
}
export async function inboxSession(req: NextRequest) {
  const token = req.cookies.get(INBOX_COOKIE)?.value || ''
  if (!/^[a-f0-9]{64}$/.test(token)) throw new WishError(401, 'Verify your phone to open My Success Wishes.')
  const db = receiverDatabase()
  const { data, error } = await db.from('success_wish_receiver_sessions')
    .select('receiver_id,expires_at').eq('token_hash', inboxDigest(token)).maybeSingle()
  if (error || !data || Date.parse(data.expires_at) <= Date.now())
    throw new WishError(401, 'Your inbox session has expired. Verify your phone again.')
  const { data: receiver } = await db.from('success_wish_receivers')
    .select('id,display_name,school_label,consent_status,phone_e164')
    .eq('id', data.receiver_id).maybeSingle()
  if (!receiver || receiver.consent_status !== 'verified') throw new WishError(401, 'This private inbox is unavailable.')
  return { db, receiver }
}
export async function enrolRecovery(db: DB, receiverId: string, replaceLostCode = false) {
  const recoverySecret = newSixCharacterRecoveryCode()
  let update = db.from('success_wish_receivers')
    .update({ recovery_secret_hash: recoveryDigest(receiverId, recoverySecret) })
    .eq('id', receiverId).eq('consent_status', 'verified')
  if (!replaceLostCode) update = update.is('recovery_secret_hash', null)
  const { data, error } = await update.select('id').maybeSingle()
  if (error) throw new WishError(503, 'Could not configure recovery.')
  if (!data) {
    const { data: existing, error: lookupError } = await db.from('success_wish_receivers')
      .select('id,recovery_secret_hash').eq('id', receiverId).eq('consent_status', 'verified').maybeSingle()
    if (lookupError || !existing?.recovery_secret_hash) throw new WishError(409, 'Recovery setup could not be confirmed. Verify again.')
    return null
  }
  return recoverySecret
}

export const RECEIVER_NOTICE_VERSION = 'receiver-2026-10-26-v1'
export async function recordConsent(db: DB, receiverId: string, challengeId: unknown, code: unknown, action: 'grant'|'withdraw', role: 'adult'|'guardian') {
  if (typeof challengeId !== 'string' || !UUID.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code))
    throw new WishError(401, 'Check the verification code and try again.')
  await takeAttempt(db, 'receiver-otp-verify:' + receiverId, 18, 900)
  const { data, error } = await db.rpc('success_wish_record_receiver_consent', {
    p_receiver: receiverId, p_challenge: challengeId, p_digest: otpDigest(receiverId, code),
    p_action: action, p_role: role, p_notice: RECEIVER_NOTICE_VERSION,
  })
  if (error) throw new WishError(503, 'Could not record your consent choice. Please try again.')
  if (data !== true) throw new WishError(401, 'Incorrect, expired or already used code. Request a new code.')
}
