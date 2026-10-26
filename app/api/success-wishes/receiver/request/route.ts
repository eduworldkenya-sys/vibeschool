import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { senderPhone } from '@/lib/success-wishes/phone-verification'
import { inboxSession } from '@/lib/success-wishes/receiver-otp'
import { receiverDatabase } from '@/lib/success-wishes/receiver'
import { hashSecret } from '@/lib/success-wishes/security'
import { failure, json, limit, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const tokenDigest = (token: string) => hashSecret('success-wishes:gift-request:' + token)
export async function GET(req: NextRequest) {
  try {
    const { db, receiver } = await inboxSession(req)
    const { data, error } = await db.from('success_wish_requests')
      .select('id,invitee_phone_e164,created_at,expires_at,cancelled_at')
      .eq('receiver_id', receiver.id).order('created_at', { ascending: false }).limit(25)
    if (error) throw error
    return reply({ requests: data || [] })
  } catch (error) { return failure(error) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { phone?: unknown }
    const { db, receiver } = await inboxSession(req)
    const phone = senderPhone(body?.phone)
    await limit('wish-request:receiver:' + receiver.id, 8, 86400)
    await limit('wish-request:global', 2000, 86400)
    const token = randomBytes(32).toString('hex')
    const { data, error } = await db.from('success_wish_requests').insert({
      receiver_id: receiver.id, invitee_phone_e164: phone,
      token_hash: tokenDigest(token), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select('id').single()
    if (error || !data) throw new WishError(503, 'Could not create this request.')
    return reply({ id: data.id, phone, url: req.nextUrl.origin + '/success-wishes/invite#token=' + token,
      expiresInDays: 7 })
  } catch (error) { return failure(error) }
}
export async function PUT(req: NextRequest) {
  try {
    const body = await json(req) as { token?: unknown }
    if (typeof body?.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token))
      throw new WishError(404, 'This wish request has expired or is unavailable.')
    await limit('wish-request-resolve:global', 1500, 60)
    const db = receiverDatabase()
    const { data, error } = await db.from('success_wish_requests')
      .select('id,receiver_id,expires_at,cancelled_at').eq('token_hash', tokenDigest(body.token)).maybeSingle()
    if (error || !data || data.cancelled_at || Date.parse(data.expires_at) <= Date.now())
      throw new WishError(404, 'This wish request has expired or is unavailable.')
    const { data: receiver } = await db.from('success_wish_receivers')
      .select('display_name,school_label,consent_status').eq('id', data.receiver_id).maybeSingle()
    if (!receiver || receiver.consent_status !== 'verified')
      throw new WishError(404, 'This wish request has expired or is unavailable.')
    return reply({ requestId: data.id, candidate: receiver.display_name, school: receiver.school_label })
  } catch (error) { return failure(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    const body = await json(req) as { requestId?: unknown }
    const { db, receiver } = await inboxSession(req)
    if (typeof body?.requestId !== 'string') throw new WishError(400, 'Check the request.')
    const { error } = await db.from('success_wish_requests')
      .update({ cancelled_at: new Date().toISOString() }).eq('id', body.requestId).eq('receiver_id', receiver.id)
    if (error) throw error
    return reply({ ok: true })
  } catch (error) { return failure(error) }
}
