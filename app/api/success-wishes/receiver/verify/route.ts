import { NextRequest } from 'next/server'
import { cardSession } from '@/lib/success-wishes/receiver'
import { consumeOtp, createInboxSession, enrolRecovery, INBOX_COOKIE, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { failure, json, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    await json(req)
    const { db, card } = await cardSession(req)
    const { data: receiver, error } = await db.from('success_wish_receivers')
      .select('phone_e164').eq('id', card.receiver_id).single()
    if (error || !receiver) throw error || new Error('Recipient missing')
    const challengeId = await issueOtp(db, card.receiver_id, receiver.phone_e164)
    return reply({ challengeId, expiresInSeconds: 300, message: 'Verification code submitted to the registered phone.' })
  } catch (error) { return failure(error) }
}
export async function PATCH(req: NextRequest) {
  try {
    const body = await json(req) as { challengeId?: unknown; code?: unknown }
    const { db, card } = await cardSession(req)
    await consumeOtp(db, card.receiver_id, body?.challengeId, body?.code)
    const recoveryCode = await enrolRecovery(db, card.receiver_id)
    const session = await createInboxSession(db, req, card.receiver_id)
    const response = reply({ ok: true, recoveryCode, inboxUrl: '/success-wishes/inbox' })
    response.cookies.set(INBOX_COOKIE, session.token, session.options)
    return response
  } catch (error) { return failure(error) }
}
