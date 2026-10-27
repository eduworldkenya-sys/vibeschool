import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { requireAdultSetup, setupDigest } from '@/lib/success-wishes/receiver-setup'
import { cardSession, receiverDatabase } from '@/lib/success-wishes/receiver'
import { consumeOtp, createInboxSession, enrolRecovery, INBOX_COOKIE, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { failure, json, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { registeredConsentRoute, verifyConsentDeclaration, ConsentPerson } from '@/lib/success-wishes/receiver-consent'

async function recipient(req: NextRequest, cardId: unknown, setupToken: unknown) {
  if (setupToken !== undefined) {
    const digest = setupDigest(setupToken)
    const db = receiverDatabase()
    const { data, error } = await db.from('success_wish_receivers')
      .select('id,phone_e164,guardian_phone_e164,consent_route,consent_status,setup_expires_at')
      .eq('setup_token_hash', digest).maybeSingle()
    if (error) throw new WishError(503, 'Recipient setup is temporarily unavailable.')
    if (!data) throw new WishError(404, 'This private setup link has expired or is unavailable.')
    const person = requireAdultSetup(data)
    return { db, receiverId: data.id as string, person: person as ConsentPerson }
  }
  const { db, card } = await cardSession(req, cardId)
  if (cardId !== card.id) throw new WishError(400, 'Select your private card first.')
  const { data, error } = await db.from('success_wish_receivers')
    .select('phone_e164,guardian_phone_e164,consent_route,consent_status')
    .eq('id', card.receiver_id).single()
  if (error || !data || data.consent_status === 'revoked')
    throw new WishError(404, 'The intended recipient is unavailable.')
  return { db, receiverId: card.receiver_id as string, person: data as ConsentPerson }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown; setupToken?: unknown }
    const { db, receiverId, person } = await recipient(req, body?.cardId, body?.setupToken)
    const { phone, purpose, consentRole } = registeredConsentRoute(person)
    const challengeId = await issueOtp(db, receiverId, phone, purpose)
    return reply({ challengeId, expiresInSeconds: 300, consentRole,
      message: consentRole === 'guardian'
        ? 'A consent verification code was submitted to the previously registered guardian phone.'
        : 'A verification code was submitted to the registered phone.' })
  } catch (error) { return failure(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown; setupToken?: unknown; challengeId?: unknown
      code?: unknown; consentRole?: unknown; consentAcknowledged?: unknown }
    const { db, receiverId, person } = await recipient(req, body?.cardId, body?.setupToken)
    const { purpose, consentRole } = registeredConsentRoute(person)
    verifyConsentDeclaration(consentRole, body?.consentRole, body?.consentAcknowledged)
    await consumeOtp(db, receiverId, body?.challengeId, body?.code, purpose)
    if (consentRole !== 'verified') {
      const { data: changed, error } = await db.from('success_wish_receivers').update({
        consent_status: 'verified', consent_verified_at: new Date().toISOString(),
      }).eq('id', receiverId).eq('consent_status', 'pending')
        .eq('consent_route', consentRole).select('id').maybeSingle()
      if (error || !changed) throw new WishError(409, 'Recipient consent could not be recorded. Restart verification.')
    }
    const recoveryCode = await enrolRecovery(db, receiverId)
    const session = await createInboxSession(db, req, receiverId)
    const response = reply({ ok: true, recoveryCode, inboxUrl: '/success-wishes/inbox' })
    response.cookies.set(INBOX_COOKIE, session.token, session.options)
    return response
  } catch (error) { return failure(error) }
}
