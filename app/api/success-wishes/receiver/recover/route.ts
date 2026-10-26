import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { receiverDatabase } from '@/lib/success-wishes/receiver'
import { consumeOtp, createInboxSession, INBOX_COOKIE, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { hashedPhoneRateKey, matchesDigest, recoveryDigest } from '@/lib/success-wishes/receiver-sms'
import { senderPhone } from '@/lib/success-wishes/phone-verification'
import { failure, json, limit, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function knownReceiver(req: NextRequest, phone: unknown, secret: unknown) {
  if (typeof secret !== 'string' || !/^[0-9A-F]{32}$/i.test(secret))
    throw new WishError(401, 'Check the registered phone and student recovery code.')
  const normalized = senderPhone(phone)
  await limit('receiver-recover:global', 1000, 86400)
  await limit('receiver-recover:' + hashedPhoneRateKey(normalized), 12, 86400)
  const db = receiverDatabase()
  const { data, error } = await db.from('success_wish_receivers')
    .select('id,recovery_secret_hash').eq('phone_e164', normalized).eq('consent_status', 'verified').limit(30)
  if (error) throw new WishError(503, 'Recovery is temporarily unavailable.')
  const matched = (data || []).filter(item =>
    item.recovery_secret_hash && matchesDigest(item.recovery_secret_hash, recoveryDigest(item.id, secret.toUpperCase())))
  if (matched.length !== 1) throw new WishError(401, 'Check the registered phone and student recovery code.')
  return { db, receiverId: matched[0].id, phone: normalized }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { phone?: unknown; recoveryCode?: unknown }
    const { db, receiverId, phone } = await knownReceiver(req, body?.phone, body?.recoveryCode)
    const challengeId = await issueOtp(db, receiverId, phone)
    return reply({ challengeId, expiresInSeconds: 300 })
  } catch (error) { return failure(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const body = await json(req) as { phone?: unknown; recoveryCode?: unknown; challengeId?: unknown; code?: unknown }
    const { db, receiverId } = await knownReceiver(req, body?.phone, body?.recoveryCode)
    await consumeOtp(db, receiverId, body?.challengeId, body?.code)
    const session = await createInboxSession(db, req, receiverId)
    const response = reply({ ok: true, inboxUrl: '/success-wishes/inbox' })
    response.cookies.set(INBOX_COOKIE, session.token, session.options)
    return response
  } catch (error) { return failure(error) }
}
