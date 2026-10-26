import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { consumeOtp, inboxCookie, inboxSession, INBOX_COOKIE, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { registeredWithdrawalRoute } from '@/lib/success-wishes/receiver-consent'
import { failure, json, limit, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export async function GET(req: NextRequest) {
  try {
    const { db, receiver } = await inboxSession(req)
    const { data, error } = await db.from('success_wish_data_requests')
      .select('id,kind,status,created_at')
      .eq('receiver_id', receiver.id).order('created_at',{ascending:false}).limit(10)
    if (error) throw error
    return reply({ requests: data || [] })
  } catch(error) { return failure(error) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { action?: unknown; cardId?: unknown; reason?: unknown; challengeId?: unknown; code?: unknown }
    const { db, receiver } = await inboxSession(req)
    await limit('receiver-safety:' + receiver.id, 20, 86400)
    if (body?.action === 'begin_withdrawal' || body?.action === 'confirm_withdrawal') {
      // Only an existing verified inbox can request this. The OTP destination is trusted
      // server-side data; never accept an alternative guardian number from a caller.
      const { data: person, error: personError } = await db.from('success_wish_receivers')
        .select('phone_e164,guardian_phone_e164,consent_route,consent_status')
        .eq('id', receiver.id).maybeSingle()
      if (personError || !person) throw new WishError(409, 'Your consent authority could not be checked.')
      const route = registeredWithdrawalRoute(person)
      if (body.action === 'begin_withdrawal') {
        const challengeId = await issueOtp(db, receiver.id, route.phone, route.purpose)
        return reply({ challengeId, expiresInSeconds: 300, consentRole: route.consentRole,
          message: route.consentRole === 'guardian'
            ? 'A withdrawal code was sent to the registered guardian phone.'
            : 'A withdrawal code was sent to the registered adult phone.' })
      }
      await consumeOtp(db, receiver.id, body.challengeId, body.code, route.purpose)
      // This status is checked on every inbox and private card read; changing it
      // immediately denies all outstanding cookies and private links.
      const { data: changed, error: consentError } = await db.from('success_wish_receivers')
        .update({ consent_status: 'revoked' })
        .eq('id', receiver.id).eq('consent_status', 'verified')
        .select('id').maybeSingle()
      if (consentError || !changed)
        throw new WishError(409, 'Consent could not be withdrawn. Please contact support.')
      // Sessions are already unusable because every protected read checks revocation.
      // Remove the stored session tokens as an additional defence in depth.
      const { error: sessionError } = await db.from('success_wish_receiver_sessions')
        .delete().eq('receiver_id', receiver.id)
      if (sessionError) console.error('Success Wishes: session cleanup failed after consent revocation')
      const response = reply({ ok: true, revoked: true,
        message: 'Consent was withdrawn. The private inbox and wishes are no longer accessible.' })
      response.cookies.set(INBOX_COOKIE, '', inboxCookie(req, 0))
      return response
    }
    if (body?.action === 'delete_data' || body?.action === 'access_data') {
      const kind = body.action === 'delete_data' ? 'deletion' : 'access'
      const { data: active, error: loadError } = await db.from('success_wish_data_requests')
        .select('id').eq('receiver_id', receiver.id).eq('kind', kind)
        .in('status', ['pending', 'reviewing']).limit(1)
      if (loadError) throw loadError
      if (!active?.length) {
        const { error } = await db.from('success_wish_data_requests').insert({ receiver_id: receiver.id, kind })
        if (error) throw error
      }
      return reply({ ok: true, pending: true, message: 'Your private data request has been recorded for review.' })
    }
    if (typeof body?.cardId !== 'string' || !UUID.test(body.cardId))
      throw new WishError(400, 'Select a wish to manage.')
    const { data: target, error: lookupError } = await db.from('success_wish_cards')
      .select('id').eq('id', body.cardId).eq('receiver_id', receiver.id).maybeSingle()
    if (lookupError || !target) throw new WishError(404, 'This card is not in your inbox.')
    if (body.action === 'hide' || body.action === 'unhide') {
      const { error } = await db.from('success_wish_cards').update({
        hidden_at: body.action === 'hide' ? new Date().toISOString() : null,
      }).eq('id', target.id).eq('receiver_id', receiver.id)
      if (error) throw error
      return reply({ ok: true })
    }
    if (body.action === 'report') {
      if (typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.trim().length > 500)
        throw new WishError(400, 'Briefly describe the issue (10 to 500 characters).')
      const { error } = await db.from('success_wish_receiver_reports').insert({
        receiver_id: receiver.id, card_id: target.id, reason: body.reason.trim(),
      })
      if (error) throw error
      return reply({ ok: true, message: 'Your report has been submitted privately.' })
    }
    throw new WishError(400, 'Choose an available action.')
  } catch (error) { return failure(error) }
}
