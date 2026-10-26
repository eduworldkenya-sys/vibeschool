import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from './contracts'
import { database, limit } from './server'
import { hashSecret } from './security'
import { hashedPhoneRateKey, newOtp, otpDigest, recoveryDigest, sendReceiverSms } from './receiver-sms'

export const INBOX_COOKIE = 'vs_wishes_receiver'
export const INBOX_AGE_SECONDS = 24 * 60 * 60
type DB = ReturnType<typeof database>
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export function inboxDigest(secret: string) {
  return hashSecret('success-wishes:receiver-inbox:' + secret)
}
export function inboxCookie(req: NextRequest, age: number) {
  return { httpOnly: true as const, sameSite: 'strict' as const,
    secure: req.nextUrl.protocol === 'https:', path: '/api/success-wishes/receiver', maxAge: age }
}
export async function issueOtp(db: DB, receiverId: string, phone: string) {
  await limit('receiver-otp:global', 1000, 86400)
  await limit('receiver-otp:' + hashedPhoneRateKey(phone), 5, 86400)
  const otp = newOtp()
  const { data: challenge, error } = await db.from('success_wish_receiver_challenges').insert({
    receiver_id: receiverId, code_hash: otpDigest(receiverId, otp),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }).select('id').single()
  if (error || !challenge) throw new WishError(503, 'Could not begin phone verification.')
  const { data: delivery, error: deliveryError } = await db.from('success_wish_sms_deliveries')
    .insert({ receiver_id: receiverId, purpose: 'recovery', status: 'queued' }).select('id').single()
  if (deliveryError || !delivery) throw new WishError(503, 'Could not queue verification SMS.')
  try {
    const result = await sendReceiverSms(phone, 'VibeSchool: Your private Success Wishes verification code is ' + otp + '. Expires in 5 minutes. Do not share it.')
    await db.from('success_wish_sms_deliveries').update({ status: 'accepted', provider_id: result.providerId, updated_at: new Date().toISOString() }).eq('id', delivery.id)
  } catch (error) {
    await db.from('success_wish_sms_deliveries').update({ status: 'failed', failure_code: 'submission_failed', updated_at: new Date().toISOString() }).eq('id', delivery.id)
    await db.from('success_wish_receiver_challenges').delete().eq('id', challenge.id)
    throw error
  }
  return challenge.id as string
}
export async function consumeOtp(db: DB, receiverId: string, challengeId: unknown, code: unknown) {
  if (typeof challengeId !== 'string' || !UUID.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code))
    throw new WishError(401, 'Check the verification code and try again.')
  await limit('receiver-otp-verify:' + receiverId, 18, 900)
  const { data, error } = await db.rpc('success_wish_consume_receiver_challenge', {
    p_challenge: challengeId, p_receiver: receiverId, p_digest: otpDigest(receiverId, code),
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
  const db = database()
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
export async function enrolRecovery(db: DB, receiverId: string) {
  const recoverySecret = randomBytes(16).toString('hex').toUpperCase()
  const { data, error } = await db.from('success_wish_receivers')
    .update({ recovery_secret_hash: recoveryDigest(receiverId, recoverySecret) })
    .eq('id', receiverId).is('recovery_secret_hash', null).select('id').maybeSingle()
  if (error) throw new WishError(503, 'Could not configure recovery.')
  return data ? recoverySecret : null
}
