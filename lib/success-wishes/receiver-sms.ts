import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { WishError } from './contracts'
import { senderPhone } from './phone-verification'
import { hashSecret } from './security'
import { receiverEnabled } from './receiver'

type Env = Record<string, string | undefined>
export function receiverSmsReady(env: Env = process.env) {
  const mode = env.SUCCESS_WISHES_AT_MODE
  return receiverEnabled(env) && env.SUCCESS_WISHES_RECEIVER_SMS_ENABLED === 'true'
    && !!env.SUCCESS_WISHES_AT_USERNAME?.trim() && !!env.SUCCESS_WISHES_AT_API_KEY?.trim()
    && (mode === 'live' || (mode === 'sandbox' && env.VERCEL_ENV === 'preview'))
    && (env.SUCCESS_WISHES_VERIFICATION_SECRET?.length || 0) >= 32
}
export function otpDigest(receiverId: string, code: string, env: Env = process.env) {
  const pepper = env.SUCCESS_WISHES_VERIFICATION_SECRET
  if (!pepper || pepper.length < 32) throw new WishError(503, 'Recovery verification is unavailable.')
  return createHmac('sha256', pepper).update('success-wishes:receiver-otp:' + receiverId + ':' + code).digest('hex')
}
export function recoveryDigest(receiverId: string, secret: string, env: Env = process.env) {
  const pepper = env.SUCCESS_WISHES_VERIFICATION_SECRET
  if (!pepper || pepper.length < 32) throw new WishError(503, 'Recovery verification is unavailable.')
  return createHmac('sha256', pepper).update('success-wishes:receiver-recovery:' + receiverId + ':' + secret).digest('hex')
}
export function matchesDigest(expected: string, supplied: string) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(supplied)) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'))
}
export function newOtp() { return randomInt(0, 1000000).toString().padStart(6, '0') }
export async function sendReceiverSms(phone: string, message: string, env: Env = process.env) {
  if (!receiverSmsReady(env)) throw new WishError(503, 'Recovery SMS is not available yet.')
  if (message.length > 320) throw new Error('SMS exceeds approved length budget.')
  const number = senderPhone(phone)
  const endpoint = env.SUCCESS_WISHES_AT_MODE === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'
  const form = new URLSearchParams({ username: env.SUCCESS_WISHES_AT_USERNAME!.trim(), to: number, message })
  if (env.SUCCESS_WISHES_AT_SENDER_ID?.trim()) form.set('from', env.SUCCESS_WISHES_AT_SENDER_ID!.trim())
  let response: Response
  try {
    response = await fetch(endpoint, { method: 'POST', headers: {
      apiKey: env.SUCCESS_WISHES_AT_API_KEY!.trim(), 'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    }, body: form.toString(), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) })
  } catch { throw new WishError(503, 'The verification SMS could not be submitted. Try again later.') }
  if (!response.ok) throw new WishError(503, 'The SMS provider rejected this message.')
  const result: unknown = await response.json().catch(() => null)
  const recipients = (result as { SMSMessageData?: { Recipients?: unknown } } | null)?.SMSMessageData?.Recipients
  if (!Array.isArray(recipients) || recipients.length !== 1) throw new WishError(503, 'The SMS provider did not accept this message.')
  const target = recipients[0] as { number?: unknown; statusCode?: unknown; status?: unknown; messageId?: unknown; cost?: unknown }
  if (target.number !== number || target.statusCode !== 102 || target.status !== 'Success')
    throw new WishError(503, 'The SMS provider did not accept this message.')
  return { providerId: typeof target.messageId === 'string' ? target.messageId : null, status: 'accepted' as const }
}
export function hashedPhoneRateKey(phone: string) {
  return hashSecret('success-wishes:receiver-rate:' + senderPhone(phone))
}
