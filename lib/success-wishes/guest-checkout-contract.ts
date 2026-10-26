// Canonical, server-only immutable input for a future registered-or-guest text-wish order.
// This is NOT a payment initiation path. The checkout server must durably lock this
// snapshot with recipient verification before any STK and must refuse a changed retry.
import { createHash } from 'node:crypto'
import { field, object, WishError } from './contracts'
import { normalizeSafaricomPhone } from './payment-contract'

const THEMES = ['heritage', 'botanical', 'nightfall', 'sunrise'] as const
export type WishTheme = typeof THEMES[number]
export const TEXT_WISH_AMOUNT_KES = 50 as const
export type TextWishSnapshot = Readonly<{
  kind: 'success_wish_text'
  theme: WishTheme
  candidate: string
  sender: string
  message: string
  examYear: string
  school: string
}>
export type GuestTextWishQuote = Readonly<{
  version: 1
  currency: 'KES'
  amountKes: typeof TEXT_WISH_AMOUNT_KES
  payerPhone: string
  idempotencyKey: string
  card: TextWishSnapshot
  cardDigest: string
}>

/** Value is server-authoritative; never accept amount, receipt, paid state or checkout ID from UI. */
export function guestTextWishQuote(input: unknown): GuestTextWishQuote {
  const b = object(input)
  if (b.version !== 'text') throw new WishError(400, 'Only text wishes are available for checkout.')
  // Reject browser price/status/receipt controls, rather than inadvertently trusting them.
  for (const fieldName of ['amountKes', 'price', 'currency', 'paid', 'paymentStatus',
    'providerReceipt', 'checkoutRequestId', 'merchantRequestId', 'paymentAttemptId']) {
    if (Object.prototype.hasOwnProperty.call(b, fieldName)) {
      throw new WishError(400, 'Payment details cannot be supplied by the sender.')
    }
  }
  if (typeof b.theme !== 'string' || !THEMES.includes(b.theme as WishTheme))
    throw new WishError(400, 'Choose one of the four Success Wishes designs.')
  const candidate = field(b.candidate, 1, 48)
  const sender = field(b.sender, 1, 48)
  const message = field(b.message, 1, 220)
  const examYear = field(b.examYear, 4, 4)
  if (!/^20\d{2}$/.test(examYear)) throw new WishError(400, 'Enter a valid exam year.')
  const school = b.school === undefined || b.school === null || b.school === ''
    ? '' : field(b.school, 1, 80)
  const payerPhone = normalizeSafaricomPhone(field(b.payerPhone, 9, 20))
  const idempotencyKey = field(b.idempotencyKey, 64, 64)
  if (!/^[a-f0-9]{64}$/.test(idempotencyKey))
    throw new WishError(400, 'The order reference is invalid. Start a new checkout.')
  const card: TextWishSnapshot = Object.freeze({
    kind: 'success_wish_text', theme: b.theme as WishTheme,
    candidate, sender, message, examYear, school,
  })
  const cardDigest = createHash('sha256')
    .update('vibeschool:success-wishes:text-card:v1:')
    .update(JSON.stringify(card))
    .digest('hex')
  return Object.freeze({
    version: 1, currency: 'KES', amountKes: TEXT_WISH_AMOUNT_KES,
    payerPhone, idempotencyKey, card, cardDigest,
  })
}

/** A retry with different wishes or a different phone must never reuse a paid attempt. */
export function sameGuestTextWishQuote(previous: GuestTextWishQuote, next: GuestTextWishQuote) {
  return previous.version === next.version
    && previous.currency === next.currency
    && previous.amountKes === next.amountKes
    && previous.idempotencyKey === next.idempotencyKey
    && previous.payerPhone === next.payerPhone
    && previous.cardDigest === next.cardDigest
}
