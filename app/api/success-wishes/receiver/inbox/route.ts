import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { RECEIVER_COOKIE, SESSION_AGE, sessionDigest, settledCardIds, verifiedCard } from '@/lib/success-wishes/receiver'
import { inboxSession } from '@/lib/success-wishes/receiver-otp'
import { failure, json, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export async function GET(req: NextRequest) {
  try {
    const { db, receiver } = await inboxSession(req)
    const { data, error } = await db.from('success_wish_cards')
      .select('id,payment_attempt_id,theme,sender_name,sender_reveal_early,opened_at,created_at,expires_at')
      .eq('receiver_id', receiver.id).is('revoked_at', null).is('hidden_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    const paidIds = await settledCardIds(db, data || [])
    const cards = (data || []).filter(card => paidIds.has(card.id)).map(card => ({
      id: card.id, theme: card.theme, sender: card.opened_at || card.sender_reveal_early ? card.sender_name : null,
      opened: !!card.opened_at, createdAt: card.created_at,
    }))
    return reply({ recipient: { name: receiver.display_name, school: receiver.school_label },
      count: cards.length, unopened: cards.filter(card => !card.opened).length, cards })
  } catch (error) { return failure(error) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await json(req) as { cardId?: unknown }
    if (typeof body?.cardId !== 'string' || !UUID.test(body.cardId))
      throw new WishError(404, 'This wish is unavailable.')
    const { db, receiver } = await inboxSession(req)
    const { card } = await verifiedCard(db, body.cardId)
    if (card.receiver_id !== receiver.id) throw new WishError(404, 'This wish is unavailable.')
    const session = randomBytes(32).toString('hex')
    const age = Math.min(SESSION_AGE, Math.floor((Date.parse(card.expires_at) - Date.now()) / 1000))
    if (age <= 0) throw new WishError(404, 'This wish is unavailable.')
    const { error } = await db.from('success_wish_card_sessions').insert({
      token_hash: sessionDigest(session), card_id: card.id,
      expires_at: new Date(Date.now() + age * 1000).toISOString(),
    })
    if (error) throw error
    const response = reply({ ok: true, url: '/success-wishes/invitation?card=' + card.id })
    response.cookies.set(RECEIVER_COOKIE, session, { httpOnly: true, sameSite: 'strict',
      secure: req.nextUrl.protocol === 'https:', path: '/api/success-wishes/receiver', maxAge: age })
    return response
  } catch (error) { return failure(error) }
}
export { logoutReceiver as DELETE } from '@/lib/success-wishes/receiver-logout'
