import { NextRequest } from 'next/server'
import { WishError } from './contracts'
import { database, limit } from './server'
import { enabled, hashSecret } from './security'

export const RECEIVER_COOKIE = 'vs_wish_card'
const SESSION_AGE = 7 * 24 * 60 * 60

export function receiverEnabled(env: Record<string, string | undefined> = process.env) {
  return enabled(env) && env.SUCCESS_WISHES_RECEIVER_ENABLED === 'true'
}
export function receiverDatabase() {
  if (!receiverEnabled()) throw new WishError(503, 'Private wishes are not open yet.')
  return database()
}
export function linkDigest(secret: string) {
  return hashSecret('success-wishes:paid-link:' + secret)
}
export function codeDigest(code: string) {
  return hashSecret('success-wishes:paid-code:' + code.toUpperCase())
}
export function sessionDigest(secret: string) {
  return hashSecret('success-wishes:paid-session:' + secret)
}
type DB = ReturnType<typeof database>
type Card = {
  id: string; receiver_id: string; payment_attempt_id: string
  theme: 'heritage'|'botanical'|'nightfall'|'sunrise'
  sender_name: string; sender_reveal_early: boolean; message: string
  exam_year: string; opened_at: string|null; revoked_at: string|null; expires_at: string; created_at: string
}
type Receiver = { display_name: string; school_label: string; consent_status: string }
async function requirePaid(db: DB, card: Card) {
  const { data: attempt, error } = await db.from('commerce_payment_attempts')
    .select('state,provider_receipt,provider_result_code,settled_at,order_id,expected_amount_kes')
    .eq('id', card.payment_attempt_id).maybeSingle()
  if (error || !attempt || attempt.state !== 'settled' || !attempt.provider_receipt
    || attempt.provider_result_code !== 0 || !attempt.settled_at || attempt.expected_amount_kes !== 50) {
    throw new WishError(404, 'This private card is unavailable.')
  }
  const { data: order, error: orderError } = await db.from('learning_product_orders')
    .select('status,refunded_at,product_snapshot').eq('id', attempt.order_id).maybeSingle()
  if (orderError || order?.status !== 'paid' || order.refunded_at
    || order.product_snapshot?.kind !== 'success_wish_text') throw new WishError(404, 'This private card is unavailable.')
}
export async function verifiedCard(db: DB, id: string) {
  const { data, error } = await db.from('success_wish_cards').select('*').eq('id', id).maybeSingle()
  const card = data as Card | null
  if (error || !card || card.revoked_at || Date.parse(card.expires_at) <= Date.now())
    throw new WishError(404, 'This private card has expired or is unavailable.')
  const { data: recipient, error: rerror } = await db.from('success_wish_receivers')
    .select('display_name,school_label,consent_status').eq('id', card.receiver_id).maybeSingle()
  if (rerror || !recipient || recipient.consent_status !== 'verified')
    throw new WishError(404, 'This private card is unavailable.')
  await requirePaid(db, card)
  return { card, recipient: recipient as Receiver }
}
export function envelope(card: Card, recipient: Receiver) {
  return { id: card.id, candidate: recipient.display_name, school: recipient.school_label,
    examYear: card.exam_year, theme: card.theme, sender: card.sender_reveal_early ? card.sender_name : null,
    opened: !!card.opened_at, createdAt: card.created_at }
}
export async function cardSession(req: NextRequest) {
  const secret = req.cookies.get(RECEIVER_COOKIE)?.value || ''
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new WishError(401, 'Open your private link or enter your card code.')
  const db = receiverDatabase()
  const { data: active, error } = await db.from('success_wish_card_sessions')
    .select('card_id,expires_at').eq('token_hash', sessionDigest(secret)).maybeSingle()
  if (error || !active || Date.parse(active.expires_at) <= Date.now())
    throw new WishError(401, 'Your card session has ended. Reopen your private link.')
  const result = await verifiedCard(db, active.card_id)
  return { db, ...result }
}
export async function cardAccess(req: NextRequest, secret: string, kind: 'link'|'code') {
  const isLink = kind === 'link'
  if (!(isLink ? /^[a-f0-9]{64}$/ : /^[0-9A-F]{32}$/).test(secret))
    throw new WishError(404, 'This card link or access code is invalid.')
  const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0, 100)
  await limit('card-access:global', 1500, 60)
  await limit('card-access:' + ip, 12, 900)
  const db = receiverDatabase()
  const column = isLink ? 'link_hash' : 'code_hash'
  const digest = isLink ? linkDigest(secret) : codeDigest(secret)
  const { data: access, error } = await db.from('success_wish_card_access')
    .select('card_id,revoked_at,expires_at').eq(column, digest).maybeSingle()
  if (error || !access || access.revoked_at || Date.parse(access.expires_at) <= Date.now())
    throw new WishError(404, 'This card link or access code is invalid, expired or revoked.')
  return { db, ...(await verifiedCard(db, access.card_id)) }
}
export { SESSION_AGE }
