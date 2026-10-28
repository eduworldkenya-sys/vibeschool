import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { receiverDatabase } from '@/lib/success-wishes/receiver'
import { consumeOtp, createInboxSession, INBOX_COOKIE, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { hashedPhoneRateKey } from '@/lib/success-wishes/receiver-sms'
import { senderPhone } from '@/lib/success-wishes/phone-verification'
import { normalizeRecoveryCode } from '@/lib/success-wishes/recovery-code'
import { selectRecoveryIdentity, type RecoveryIdentity } from '@/lib/success-wishes/recovery-identity'
import { failure, json, limit, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const QUERY_LIMIT = 50
const SELECT = 'id,phone_e164,guardian_phone_e164,consent_route,consent_status,recovery_secret_hash'

async function knownReceiver(phone: unknown, secret: unknown) {
  const normalized = senderPhone(phone)
  const isBackup = typeof secret === 'string' && secret.trim().length > 0
  const backup = isBackup ? normalizeRecoveryCode(secret) : null
  // An invalid backup cannot become an easier phone-only request.
  if (isBackup && !backup) throw new WishError(401, 'Check your details or open your original private card.')
  await limit('receiver-recover:global', 1000, 86400)
  await limit('receiver-recover:' + hashedPhoneRateKey(normalized), 12, 86400)
  const db = receiverDatabase()
  // Query both registered recipient and guardian contacts. Never trust a number supplied as
  // guardian authority without checking the persisted consent route.
  const [direct, guardian] = await Promise.all([
    db.from('success_wish_receivers').select(SELECT).eq('phone_e164', normalized).eq('consent_status', 'verified').limit(QUERY_LIMIT),
    db.from('success_wish_receivers').select(SELECT).eq('guardian_phone_e164', normalized).eq('consent_status', 'verified').limit(QUERY_LIMIT),
  ])
  if (direct.error || guardian.error) throw new WishError(503, 'Recovery is temporarily unavailable.')
  // Do not silently choose a receiver if a shared number reaches the query cap.
  if ((direct.data || []).length === QUERY_LIMIT || (guardian.data || []).length === QUERY_LIMIT)
    return { db, receiverId: null as string | null, phone: normalized }
  const all = new Map<string, RecoveryIdentity>()
  for (const person of [...(direct.data || []), ...(guardian.data || [])] as RecoveryIdentity[])
    all.set(person.id, person)
  const match = selectRecoveryIdentity([...all.values()], normalized, backup)
  return { db, receiverId: match?.id ?? null, phone: normalized }
}

export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { phone?: unknown; recoveryCode?: unknown }
    const { db, receiverId, phone } = await knownReceiver(body?.phone, body?.recoveryCode)
    // The response never reveals whether the number exists or belongs to multiple students.
    // An unmatched/ambiguous number does not trigger an SMS or create a usable challenge.
    const challengeId = receiverId ? await issueOtp(db, receiverId, phone) : randomUUID()
    return reply({ challengeId, expiresInSeconds: 300 })
  } catch (error) { return failure(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const body = await json(req) as { phone?: unknown; recoveryCode?: unknown; challengeId?: unknown; code?: unknown }
    const { db, receiverId } = await knownReceiver(body?.phone, body?.recoveryCode)
    if (!receiverId) throw new WishError(401, 'Incorrect or expired code. Check your number or open your original card.')
    await consumeOtp(db, receiverId, body?.challengeId, body?.code)
    const session = await createInboxSession(db, req, receiverId)
    const response = reply({ ok: true, inboxUrl: '/success-wishes/inbox' })
    response.cookies.set(INBOX_COOKIE, session.token, session.options)
    return response
  } catch (error) { return failure(error) }
}
