import {trustedReceiverSession as inboxSession} from '@/lib/success-wishes/receiver-collection'
import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { failure, json, reply } from '@/lib/success-wishes/server'
import { cardAccess, cardSession, envelope, RECEIVER_COOKIE, SESSION_AGE, sessionDigest } from '@/lib/success-wishes/receiver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function deviceEnvelope(req: NextRequest, card: Parameters<typeof envelope>[0], recipient: Parameters<typeof envelope>[1]) {
  let verifiedDevice = false
  try { verifiedDevice = (await inboxSession(req)).receiver.id === card.receiver_id } catch { /* Sealed until the intended contact verifies this device. */ }
  return { ...envelope(card, recipient), sender: null, consentRequired: recipient.consent_status !== 'verified' || !verifiedDevice }
}

const cookieOptions = (req: NextRequest, age: number) => ({
  httpOnly: true as const, sameSite: 'strict' as const,
  secure: req.nextUrl.protocol === 'https:', path: '/api/success-wishes/receiver', maxAge: age,
})
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { token?: unknown; code?: unknown }
    if (!body || typeof body !== 'object') throw new WishError(400, 'Check your private link or code.')
    const hasToken = typeof body.token === 'string' && !!body.token
    const secret = hasToken ? body.token as string : typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/[-\s]/g, '') : ''
    const { db, card, recipient } = await cardAccess(req, secret, hasToken ? 'link' : 'code')
    const rawSession = randomBytes(32).toString('hex')
    const age = Math.min(SESSION_AGE, Math.floor((Date.parse(card.expires_at) - Date.now()) / 1000))
    if (age <= 0) throw new WishError(404, 'This private card is unavailable.')
    const { error } = await db.from('success_wish_card_sessions').insert({
      token_hash: sessionDigest(rawSession), card_id: card.id,
      expires_at: new Date(Date.now() + age * 1000).toISOString(),
    })
    if (error) throw error
    const response = reply({ card: await deviceEnvelope(req, card, recipient) })
    response.cookies.set(RECEIVER_COOKIE, rawSession, cookieOptions(req, age))
    return response
  } catch (error) { return failure(error) }
}
export async function GET(req: NextRequest) {
  try {
    const { card, recipient } = await cardSession(req, req.nextUrl.searchParams.get('card') || undefined)
    return reply({ card: await deviceEnvelope(req, card, recipient) })
  } catch (error) { return failure(error) }
}
export async function PUT(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown }
    const { db, card, recipient } = await cardSession(req, body?.cardId)
    if (body?.cardId !== card.id) throw new WishError(400, 'Select the card you intend to open.')
    if (recipient.consent_status !== 'verified')
      throw new WishError(403, 'Recipient verification and consent are required to read this wish.')
    const { receiver } = await inboxSession(req)
    if (receiver.id !== card.receiver_id) throw new WishError(403, 'Verify this recipient on this device before opening the card.')
    if (!card.opened_at) {
      const { error } = await db.from('success_wish_cards')
        .update({ opened_at: new Date().toISOString() }).eq('id', card.id).is('opened_at', null)
      if (error) throw error
    }
    return reply({ card: { ...envelope(card, recipient), opened: true, sender: card.sender_name,
      message: card.message } })
  } catch (error) { return failure(error) }
}
export { logoutReceiver as DELETE } from '@/lib/success-wishes/receiver-logout'
