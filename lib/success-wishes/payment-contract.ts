// Shared validation rules for a future guest-wish order routed through the
// canonical M-Pesa runtime control and immutable callback event ledger.
// Never use a sender-entered receipt to mark a message paid.
export type AttemptState =
  | 'created' | 'submitting' | 'awaiting_customer'
  | 'settled' | 'failed' | 'cancelled' | 'expired'
  | 'reconciliation_required' | 'refund_pending' | 'refunded'
export type Attempt = {
  state: AttemptState
  checkoutRequestId: string
  merchantRequestId?: string | null
  expectedAmountKes: number
  phone: string
  providerReceipt?: string | null
}
export type ProviderCallback = {
  checkoutRequestId: string
  merchantRequestId?: string | null
  resultCode: number
  amountKes?: number | null
  phone?: string | null
  receipt?: string | null
}
export type Reconciliation =
  | {decision:'settle';receipt:string}
  | {decision:'duplicate'}
  | {decision:'fail'}
  | {decision:'reconciliation_required';reason:string}

export function normalizeSafaricomPhone(value: string): string {
  const digits = value.replace(/[\s+()-]/g, '')
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1)
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits
  throw new Error('Enter a valid Kenyan mobile phone number.')
}

// M-Pesa callbacks are not an authenticated payment instruction on their own.
// The caller MUST first verify provider callback origin/secret, durably persist
// an immutable event and lock the payment attempt in its database transaction.
export function reconcileWishPayment(attempt: Attempt, event: ProviderCallback): Reconciliation {
  if (!attempt.checkoutRequestId || attempt.checkoutRequestId !== event.checkoutRequestId) {
    return {decision:'reconciliation_required',reason:'checkout_mismatch'}
  }
  if (attempt.merchantRequestId && attempt.merchantRequestId !== event.merchantRequestId) {
    return {decision:'reconciliation_required',reason:'merchant_mismatch'}
  }
  if (!Number.isInteger(event.resultCode)) {
    return {decision:'reconciliation_required',reason:'invalid_result'}
  }
  const receipt = event.receipt?.trim() ?? ''
  if (attempt.state === 'refunded' || attempt.state === 'refund_pending') {
    return {decision:'reconciliation_required',reason:'late_callback_during_refund'}
  }
  if (attempt.state === 'settled') {
    return event.resultCode === 0 && receipt !== '' && receipt === attempt.providerReceipt
      ? {decision:'duplicate'} : {decision:'reconciliation_required',reason:'conflicting_settlement'}
  }
  if (attempt.state !== 'awaiting_customer' && attempt.state !== 'reconciliation_required') {
    return {decision:'reconciliation_required',reason:'unexpected_attempt_state'}
  }
  if (event.resultCode !== 0) {
    return attempt.state === 'reconciliation_required'
      ? {decision:'reconciliation_required',reason:'late_failed_callback'}
      : {decision:'fail'}
  }
  if (!Number.isSafeInteger(attempt.expectedAmountKes) || attempt.expectedAmountKes <= 0
    || event.amountKes !== attempt.expectedAmountKes || !/^[A-Z0-9]{6,30}$/i.test(receipt)) {
    return {decision:'reconciliation_required',reason:'amount_or_receipt_mismatch'}
  }
  try {
    if (!event.phone || normalizeSafaricomPhone(event.phone) !== normalizeSafaricomPhone(attempt.phone)) {
      return {decision:'reconciliation_required',reason:'phone_mismatch'}
    }
  } catch {
    return {decision:'reconciliation_required',reason:'phone_mismatch'}
  }
  return {decision:'settle',receipt}
}
