/**
 * VibeSchool universal commerce sandbox contracts.
 *
 * Deliberately in-memory/pure: NOT a payment endpoint, database migration, provider
 * callback verifier, or entitlement writer. Never call grant-entitlement from here.
 */
export type ProductKind =
  | 'teacher_credits' | 'learning_product' | 'exam_access'
  | 'success_wish' | 'school_subscription' | 'premium_feature'

export type CheckoutOwner =
  | { kind: 'profile'; profileId: string }
  | { kind: 'guest'; guestReference: string }

export type SandboxOrder = {
  mode: 'sandbox'
  id: string
  productKind: ProductKind
  itemReference: string
  amountKes: number
  owner: CheckoutOwner
  idempotencyKey: string
  state: 'created'
}

export type SandboxAttempt = {
  mode: 'sandbox'
  orderId: string
  checkoutRequestId: string
  merchantRequestId: string
  phone: string
  expectedAmountKes: number
  state: 'awaiting_customer' | 'settled' | 'failed' | 'cancelled' | 'expired' | 'reconciliation_required'
  receipt: string | null
}

export type SandboxCallback = {
  checkoutRequestId: string
  merchantRequestId: string
  resultCode: number
  amountKes?: number | null
  phone?: string | null
  receipt?: string | null
}
export type SandboxDecision =
  | { action: 'settle'; attempt: SandboxAttempt }
  | { action: 'duplicate'; attempt: SandboxAttempt }
  | { action: 'fail'; attempt: SandboxAttempt }
  | { action: 'quarantine'; attempt: SandboxAttempt; reason: string }

const PRODUCT_KINDS: readonly string[] = [
  'teacher_credits', 'learning_product', 'exam_access',
  'success_wish', 'school_subscription', 'premium_feature',
]
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_:-]{5,100}$/
const IDEMPOTENCY = /^[a-zA-Z0-9_-]{16,80}$/
const RECEIPT = /^[A-Z0-9]{6,30}$/

export function normalizeKenyanPhone(value: string): string {
  const digits = value.trim().replace(/[ +()-]/g, '')
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1)
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits
  throw new Error('Invalid Kenyan M-Pesa phone number')
}

/** Only trusted server-side catalogue/price snapshots may call this constructor. */
export function makeSandboxOrder(input: {
  orderId: string
  productKind: ProductKind
  itemReference: string
  trustedPriceKes: number
  owner: CheckoutOwner
  idempotencyKey: string
}): SandboxOrder {
  if (!ID.test(input.orderId) || !ID.test(input.itemReference)
    || !PRODUCT_KINDS.includes(input.productKind)
    || !Number.isSafeInteger(input.trustedPriceKes)
    || input.trustedPriceKes < 1 || input.trustedPriceKes > 250000
    || !IDEMPOTENCY.test(input.idempotencyKey)
    || (input.owner.kind !== 'guest' && input.owner.kind !== 'profile')
    || !ID.test(input.owner.kind === 'guest'
      ? input.owner.guestReference : input.owner.profileId)) {
    throw new Error('Invalid trusted commerce order')
  }
  return {
    mode: 'sandbox', id: input.orderId, productKind: input.productKind,
    itemReference: input.itemReference, amountKes: input.trustedPriceKes,
    owner: input.owner, idempotencyKey: input.idempotencyKey, state: 'created',
  }
}

/**
 * Deliberate two-part gate: preview/development plus explicit sandbox flag.
 * MPESA_ENV=production never passes; no code in this module turns on the
 * existing production mpesa_runtime_control initiation switch.
 */
export function assertDarajaSandboxOnly(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production' && env.VERCEL_ENV !== 'preview'
    || !['preview', 'development'].includes(env.VERCEL_ENV || '')
    || env.COMMERCE_DARAJA_SANDBOX_ENABLED !== 'true'
    || env.MPESA_ENV !== 'sandbox') {
    throw new Error('Universal commerce sandbox is disabled')
  }
}

/** Provider responses are acknowledgements, NOT receipts or payment proof. */
export function recordSandboxAcknowledgement(
  order: SandboxOrder,
  phone: string,
  response: { checkoutRequestId: string; merchantRequestId: string },
): SandboxAttempt {
  if (order.mode !== 'sandbox' || order.state !== 'created'
    || !ID.test(response.checkoutRequestId)
    || !ID.test(response.merchantRequestId)) {
    throw new Error('Invalid sandbox STK acknowledgement')
  }
  return {
    mode: 'sandbox', orderId: order.id, phone: normalizeKenyanPhone(phone),
    checkoutRequestId: response.checkoutRequestId,
    merchantRequestId: response.merchantRequestId,
    expectedAmountKes: order.amountKes, state: 'awaiting_customer', receipt: null,
  }
}

/**
 * Pure state transition for TEST FIXTURES ONLY. A caller cannot establish
 * provider authenticity with a request body: real callbacks require secured
 * ingress, immutable events, provider reconciliation and a DB row lock.
 */
export function evaluateSandboxCallback(
  current: SandboxAttempt, event: SandboxCallback,
): SandboxDecision {
  const quarantine = (reason: string): SandboxDecision => ({
    action: 'quarantine',
    reason,
    attempt: { ...current, state: 'reconciliation_required' },
  })
  if (current.mode !== 'sandbox') return quarantine('not_sandbox')
  if (current.checkoutRequestId !== event.checkoutRequestId
    || current.merchantRequestId !== event.merchantRequestId) {
    return quarantine('provider_reference_mismatch')
  }
  if (!Number.isSafeInteger(event.resultCode)) return quarantine('invalid_result')
  if (current.state === 'settled') {
    return event.resultCode === 0 && event.receipt === current.receipt
      && event.amountKes === current.expectedAmountKes
      && !!event.phone && normalizePhoneEqual(current.phone, event.phone)
      ? { action: 'duplicate', attempt: current }
      : quarantine('conflicting_callback_after_settlement')
  }
  if (current.state !== 'awaiting_customer') return quarantine('unexpected_attempt_state')
  if (event.resultCode !== 0) {
    const state = event.resultCode === 1032 ? 'cancelled'
      : event.resultCode === 1037 ? 'expired' : 'failed'
    return { action: 'fail', attempt: { ...current, state } }
  }
  if (!Number.isSafeInteger(event.amountKes) || event.amountKes !== current.expectedAmountKes
    || !RECEIPT.test(event.receipt || '')
    || !event.phone || !normalizePhoneEqual(current.phone, event.phone)) {
    return quarantine('invalid_settlement_evidence')
  }
  return {
    action: 'settle',
    attempt: { ...current, state: 'settled', receipt: event.receipt! },
  }
}

function normalizePhoneEqual(expected: string, received: string): boolean {
  try { return normalizeKenyanPhone(expected) === normalizeKenyanPhone(received) }
  catch { return false }
}

/** Simulated receipts may NEVER unlock a real product. */
export function canGrantLiveEntitlement(_: SandboxAttempt): false { return false }
