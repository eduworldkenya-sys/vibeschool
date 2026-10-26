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
  id: string; receiver_id: string; payment_attempt_id: string|null; guest_order_id?:string|null
  theme: 'heritage'|'botanical'|'nightfall'|'sunrise'
  sender_name: string; sender_reveal_early: boolean; message: string
  exam_year: string; opened_at: string|null; revoked_at: string|null; expires_at: string; created_at: string
}
type Receiver = { display_name: string; school_label: string; consent_status: string }
async function requirePaid(db: DB, card: Card) {
  if(card.guest_order_id){
    const {data:o,error}=await db.from('success_wish_guest_orders').select('state,provider_receipt,provider_verified_at,settled_at,refunded_at,amount_kes,receiver_id,card').eq('id',card.guest_order_id).maybeSingle()
    if(error||!o||o.state!=='settled'||!o.provider_receipt||!o.provider_verified_at||!o.settled_at||o.refunded_at||o.amount_kes!==50||o.receiver_id!==card.receiver_id||o.card?.kind!=='success_wish_text')throw new WishError(404,'This private card is unavailable.')
    return o.card
  }
  const { data: attempt, error } = await db.from('commerce_payment_attempts')
    .select('provider,state,provider_receipt,provider_result_code,settled_at,callback_received_at,order_id,expected_amount_kes')
    .eq('id', card.payment_attempt_id).maybeSingle()
  if (error || !attempt || attempt.provider !== 'mpesa' || attempt.state !== 'settled' || !attempt.provider_receipt
    || attempt.provider_result_code !== 0 || !attempt.settled_at || !attempt.callback_received_at || attempt.expected_amount_kes !== 50) {
    throw new WishError(404, 'This private card is unavailable.')
  }
  const { data: order, error: orderError } = await db.from('learning_product_orders')
    .select('status,refunded_at,product_snapshot,amount_kes').eq('id', attempt.order_id).maybeSingle()
  if (orderError || order?.status !== 'paid' || order.refunded_at || order.amount_kes !== 50
    || order.product_snapshot?.kind !== 'success_wish_text') throw new WishError(404, 'This private card is unavailable.')
  return null
}
export async function verifiedCard(db: DB, id: string, allowPending = false) {
  const { data, error } = await db.from('success_wish_cards').select('*').eq('id', id).maybeSingle()
  const card = data as Card | null
  if (error || !card || card.revoked_at || Date.parse(card.expires_at) <= Date.now())
    throw new WishError(404, 'This private card has expired or is unavailable.')
  const { data: recipient, error: rerror } = await db.from('success_wish_receivers')
    .select('display_name,school_label,consent_status').eq('id', card.receiver_id).maybeSingle()
  if (rerror || !recipient || (recipient.consent_status !== 'verified' && !(allowPending && recipient.consent_status === 'pending')))
    throw new WishError(404, 'This private card is unavailable.')
  const saved=await requirePaid(db, card)
  if(saved){recipient.display_name=saved.candidate;recipient.school_label=saved.school}
  return { card, recipient: recipient as Receiver }
}
export function envelope(card: Card, recipient: Receiver) {
  return { id: card.id, candidate: recipient.display_name, school: recipient.school_label,
    examYear: card.exam_year, theme: card.theme, sender: card.sender_reveal_early ? card.sender_name : null,
    opened: !!card.opened_at, consentRequired: recipient.consent_status !== 'verified', createdAt: card.created_at }
}
export async function cardSession(req: NextRequest, expectedCardId?: unknown) {
  const secret = req.cookies.get(RECEIVER_COOKIE)?.value || ''
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new WishError(401, 'Open your private link or enter your card code.')
  const db = receiverDatabase()
  const { data: active, error } = await db.from('success_wish_card_sessions')
    .select('card_id,expires_at').eq('token_hash', sessionDigest(secret)).maybeSingle()
  if (error || !active || Date.parse(active.expires_at) <= Date.now())
    throw new WishError(401, 'Your card session has ended. Reopen your private link.')
  if (expectedCardId !== undefined && expectedCardId !== active.card_id)
    throw new WishError(409, 'Another card was opened on this device. Return to your inbox or reopen this card link.')
  const result = await verifiedCard(db, active.card_id, true)
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
  return { db, ...(await verifiedCard(db, access.card_id, true)) }
}
export { SESSION_AGE }

/** Batch-check gift eligibility before listing private inbox cards. Never show refunded or simulated gifts. */
export async function settledCardIds(db: DB, cards: Pick<Card, 'id' | 'payment_attempt_id' | 'guest_order_id'>[]) {
  if (!cards.length) return new Set<string>()
  const guestIds=cards.flatMap(c=>c.guest_order_id?[c.guest_order_id]:[]),validGuest=new Set<string>()
  if(guestIds.length){
    const {data,error}=await db.from('success_wish_guest_orders').select('id,state,provider_receipt,provider_verified_at,settled_at,refunded_at,amount_kes').in('id',guestIds)
    if(error)throw new WishError(503,'Could not verify your received wishes.')
    const eligible=new Set((data||[]).filter(o=>o.state==='settled'&&o.provider_receipt&&o.provider_verified_at&&o.settled_at&&!o.refunded_at&&o.amount_kes===50).map(o=>o.id))
    for(const c of cards)if(c.guest_order_id&&eligible.has(c.guest_order_id))validGuest.add(c.id)
  }
  const commerceCards=cards.filter(c=>c.payment_attempt_id)
  if(!commerceCards.length)return validGuest
  const { data: attempts, error: aerr } = await db.from('commerce_payment_attempts')
    .select('id,order_id,provider,state,provider_receipt,provider_result_code,settled_at,callback_received_at,expected_amount_kes')
    .in('id', commerceCards.map(card => card.payment_attempt_id))
  if (aerr) throw new WishError(503, 'Could not verify your received wishes.')
  const eligible = (attempts || []).filter(a => a.provider === 'mpesa' && a.state === 'settled'
    && a.provider_receipt && a.provider_result_code === 0 && a.settled_at && a.callback_received_at
    && a.expected_amount_kes === 50)
  if (!eligible.length) return validGuest
  const { data: orders, error: oerr } = await db.from('learning_product_orders')
    .select('id,status,refunded_at,amount_kes,product_snapshot').in('id', eligible.map(a => a.order_id))
  if (oerr) throw new WishError(503, 'Could not verify your received wishes.')
  const validOrders = new Set((orders || []).filter(o => o.status === 'paid' && !o.refunded_at
    && o.amount_kes === 50 && o.product_snapshot?.kind === 'success_wish_text').map(o => o.id))
  const validAttempts = new Set(eligible.filter(a => validOrders.has(a.order_id)).map(a => a.id))
  return new Set([...validGuest,...commerceCards.filter(c => validAttempts.has(c.payment_attempt_id)).map(c => c.id)])
}
