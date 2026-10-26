import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { failure, json, reply, sameOrigin } from '@/lib/success-wishes/server'
import { cardAccess, cardSession, envelope, RECEIVER_COOKIE, SESSION_AGE, sessionDigest } from '@/lib/success-wishes/receiver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    const response = reply({ card: envelope(card, recipient) })
    response.cookies.set(RECEIVER_COOKIE, rawSession, cookieOptions(req, age))
    return response
  } catch (error) { return failure(error) }
}
export async function GET(req: NextRequest) {
  try {
    const { card, recipient } = await cardSession(req)
    return reply({ card: envelope(card, recipient) })
  } catch (error) { return failure(error) }
}
export async function PUT(req: NextRequest) {
  try {
    sameOrigin(req)
    const { db, card, recipient } = await cardSession(req)
    if (!card.opened_at) {
      const { error } = await db.from('success_wish_cards')
        .update({ opened_at: new Date().toISOString() }).eq('id', card.id).is('opened_at', null)
      if (error) throw error
    }
    return reply({ card: { ...envelope(card, recipient), opened: true, sender: card.sender_name,
      message: card.message } })
  } catch (error) { return failure(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    sameOrigin(req)
    const raw = req.cookies.get(RECEIVER_COOKIE)?.value || ''
    if (/^[a-f0-9]{64}$/.test(raw)) {
      const { receiverDatabase } = await import('@/lib/success-wishes/receiver')
      const { error } = await receiverDatabase().from('success_wish_card_sessions')
        .delete().eq('token_hash', sessionDigest(raw))
      if (error) throw error
    }
    const response = reply({ ok: true })
    response.cookies.set(RECEIVER_COOKIE, '', cookieOptions(req, 0))
    return response
  } catch (error) {
    const response = failure(error)
    if (req.headers.get('origin') === req.nextUrl.origin) response.cookies.set(RECEIVER_COOKIE, '', cookieOptions(req, 0))
    return response
  }
}
