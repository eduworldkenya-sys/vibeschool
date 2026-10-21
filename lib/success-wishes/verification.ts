import { createHmac, randomInt } from 'node:crypto'
import { WishError } from './contracts'
import { equalHash } from './security'

type Env = Record<string, string | undefined>
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function senderEmail(value: unknown): string {
  if (typeof value !== 'string') throw new WishError(400, 'Enter an email address you can access.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL.test(email) || email.includes('..')) {
    throw new WishError(400, 'Enter an email address you can access.')
  }
  return email
}
export function senderVerificationReady(env: Env = process.env): boolean {
  return env.SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED === 'true'
    && typeof env.SUCCESS_WISHES_VERIFICATION_SECRET === 'string'
    && env.SUCCESS_WISHES_VERIFICATION_SECRET.length >= 32
    && !!env.SUCCESS_WISHES_RESEND_API_KEY?.trim()
    && !!env.SUCCESS_WISHES_EMAIL_FROM?.trim()
}
export function senderFingerprint(email: string, secret: string): string {
  if (secret.length < 32) throw new Error('Sender verification secret is not configured.')
  return createHmac('sha256', secret).update('success-wishes:email:' + senderEmail(email)).digest('hex')
}
export function senderChallengeHash(fingerprint: string, code: string, secret: string): string {
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || !/^\d{6}$/.test(code) || secret.length < 32) {
    throw new Error('Invalid sender challenge.')
  }
  return createHmac('sha256', secret).update('success-wishes:code:' + fingerprint + ':' + code).digest('hex')
}
export function senderCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}
export function senderCodeMatches(expected: string, actual: string): boolean {
  return equalHash(expected, actual)
}
export async function sendSenderCode(email: string, code: string, opts: {
  env?: Env; fetcher?: typeof fetch; fingerprint: string
}): Promise<void> {
  const env = opts.env ?? process.env
  if (!senderVerificationReady(env)) throw new Error('Sender email is not configured.')
  const response = await (opts.fetcher ?? fetch)('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.SUCCESS_WISHES_RESEND_API_KEY!.trim(),
      'Content-Type': 'application/json',
      'Idempotency-Key': 'wish-otp-' + opts.fingerprint.slice(0, 16) + '-' + code,
    },
    body: JSON.stringify({
      from: env.SUCCESS_WISHES_EMAIL_FROM!.trim(),
      to: [senderEmail(email)],
      subject: 'Your VibeSchool verification code',
      text: 'Your Success Wishes code is ' + code + '. It expires in 10 minutes. Do not share this code.',
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('Sender verification email provider rejected the request.')
}
