import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { cardSession } from '@/lib/success-wishes/receiver'
import { consumeOtp, createInboxSession, enrolRecovery, INBOX_COOKIE, issueOtp, recordConsent } from '@/lib/success-wishes/receiver-otp'
import { failure, json, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { registeredConsentRoute, verifyConsentDeclaration, ConsentPerson } from '@/lib/success-wishes/receiver-consent'

async function recipient(req: NextRequest, cardId: unknown) {
  const { db, card } = await cardSession(req, cardId)
  const { data, error } = await db.from('success_wish_receivers')
    .select('phone_e164,guardian_phone_e164,consent_route,consent_status')
    .eq('id', card.receiver_id).single()
  if (error || !data || data.consent_status === 'revoked')
    throw new WishError(404, 'The intended recipient is unavailable.')
  return { db, card, person: data as ConsentPerson }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown }
    const { db, card, person } = await recipient(req, body?.cardId)
    if (body?.cardId !== card.id) throw new WishError(400, 'Select your private card first.')
    const { phone, purpose, consentRole } = registeredConsentRoute(person)
    const challengeId = await issueOtp(db, card.receiver_id, phone, purpose)
    return reply({ challengeId, expiresInSeconds: 300, consentRole,
      message: consentRole === 'guardian'
        ? 'A consent verification code was submitted to the previously registered guardian phone.'
        : 'A verification code was submitted to the registered phone.' })
  } catch (error) { return failure(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown; challengeId?: unknown
      code?: unknown; consentRole?: unknown; consentAcknowledged?: unknown; replaceLostRecoveryCode?: unknown }
    const { db, card, person } = await recipient(req, body?.cardId)
    if (body?.cardId !== card.id) throw new WishError(400, 'Select your private card first.')
    const { purpose, consentRole } = registeredConsentRoute(person)
    verifyConsentDeclaration(consentRole, body?.consentRole, body?.consentAcknowledged)
    if (consentRole === 'verified') await consumeOtp(db, card.receiver_id, body?.challengeId, body?.code, purpose)
    else await recordConsent(db, card.receiver_id, body?.challengeId, body?.code, 'grant', consentRole)
    const recoveryCode = await enrolRecovery(db, card.receiver_id, body.replaceLostRecoveryCode === true)
    const session = await createInboxSession(db, req, card.receiver_id)
    const response = reply({ ok: true, recoveryCode, inboxUrl: '/success-wishes/inbox' })
    response.cookies.set(INBOX_COOKIE, session.token, session.options)
    return response
  } catch (error) { return failure(error) }
}
