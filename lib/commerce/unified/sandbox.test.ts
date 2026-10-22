import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeSandboxOrder, recordSandboxAcknowledgement, evaluateSandboxCallback,
  canGrantLiveEntitlement, assertDarajaSandboxOnly, normalizeKenyanPhone,
} from './sandbox'
import { sendUniversalDarajaSandboxStk, type DarajaSandboxSettings } from './daraja-sandbox'

const order = () => makeSandboxOrder({
  orderId: 'order_123456789',
  productKind: 'learning_product',
  itemReference: 'ebook_form4_biology',
  trustedPriceKes: 300,
  owner: { kind: 'profile', profileId: 'profile_123456' },
  idempotencyKey: 'idempotency_123456789',
})
const ack = () => recordSandboxAcknowledgement(order(), '0712345678', {
  checkoutRequestId: 'ws_CO_1234567',
  merchantRequestId: 'merchant_12345',
})
const success = {
  checkoutRequestId: 'ws_CO_1234567',
  merchantRequestId: 'merchant_12345',
  resultCode: 0,
  amountKes: 300,
  phone: '+254712345678',
  receipt: 'TSA1234567',
}
const settings: DarajaSandboxSettings = {
  consumerKey: 'sandbox-key',
  consumerSecret: 'sandbox-secret',
  passkey: 'sandbox-passkey',
  businessShortCode: '174379',
  partyB: '174379',
  transactionType: 'CustomerPayBillOnline',
  callbackUrl: 'https://example-ref.supabase.co/functions/v1/unified-commerce-sandbox-callback',
  testPhone: '254712345678',
}
const env = {
  VERCEL_ENV: 'preview',
  NODE_ENV: 'production',
  COMMERCE_DARAJA_SANDBOX_ENABLED: 'true',
  MPESA_ENV: 'sandbox',
}
test('one universal order schema covers every paid VibeSchool product', () => {
  const types = ['teacher_credits', 'learning_product', 'exam_access',
    'success_wish', 'school_subscription', 'premium_feature'] as const
  for (const productKind of types) {
    const actual = makeSandboxOrder({ ...order(), productKind, trustedPriceKes: 50 })
    assert.equal(actual.productKind, productKind)
    assert.equal(actual.amountKes, 50)
    assert.equal(actual.mode, 'sandbox')
  }
  const guest = makeSandboxOrder({ ...order(), owner: { kind: 'guest', guestReference: 'guest_12345678' } })
  assert.equal(guest.owner.kind, 'guest')
})
test('rejects malformed or client-like pricing and identifiers', () => {
  for (const trustedPriceKes of [0,-1,0.5,Infinity,NaN,250001]) {
    assert.throws(() => makeSandboxOrder({ ...order(), trustedPriceKes }))
  }
  assert.throws(() => makeSandboxOrder({ ...order(), productKind: 'unsupported' as never }))
  assert.throws(() => makeSandboxOrder({ ...order(), idempotencyKey: 'short' }))
  assert.throws(() => makeSandboxOrder({ ...order(), itemReference: 'x' }))
})
test('strict Kenya phone normalization rejects injection and wrong country', () => {
  assert.equal(normalizeKenyanPhone('0712345678'), '254712345678')
  assert.equal(normalizeKenyanPhone('+254 712 345 678'), '254712345678')
  for (const bad of ['+255712345678', '254912345678', '0;DROP', '', '071234567890']) {
    assert.throws(() => normalizeKenyanPhone(bad))
  }
})
test('sandbox transport gates fail closed and never permit production', () => {
  assert.doesNotThrow(() => assertDarajaSandboxOnly(env))
  for (const wrong of [
    { ...env, VERCEL_ENV: 'production' },
    { ...env, MPESA_ENV: 'production' },
    { ...env, COMMERCE_DARAJA_SANDBOX_ENABLED: 'false' },
    { ...env, VERCEL_ENV: undefined },
  ]) assert.throws(() => assertDarajaSandboxOnly(wrong))
})
test('STK acknowledgement never counts as settlement or entitlement', () => {
  const initial = ack()
  assert.equal(initial.state, 'awaiting_customer')
  assert.equal(initial.receipt, null)
  assert.equal(canGrantLiveEntitlement(initial), false)
})
test('matched sandbox success is idempotent but never grants real entitlements', () => {
  const done = evaluateSandboxCallback(ack(), success)
  assert.equal(done.action, 'settle')
  assert.equal(done.attempt.state, 'settled')
  assert.equal(done.attempt.receipt, success.receipt)
  assert.equal(canGrantLiveEntitlement(done.attempt), false)
  const replay = evaluateSandboxCallback(done.attempt, success)
  assert.equal(replay.action, 'duplicate')
  assert.deepEqual(replay.attempt, done.attempt)
})
test('mismatch/forgery/refund-like failures quarantine rather than settle', () => {
  for (const modified of [
    { ...success, checkoutRequestId: 'OTHER' },
    { ...success, merchantRequestId: 'OTHER' },
    { ...success, amountKes: 301 },
    { ...success, phone: '0712345679' },
    { ...success, receipt: '' },
    { ...success, resultCode: NaN },
  ]) {
    assert.equal(evaluateSandboxCallback(ack(), modified).action, 'quarantine')
  }
  assert.equal(evaluateSandboxCallback(ack(), { ...success, resultCode: 1032 }).attempt.state, 'cancelled')
  assert.equal(evaluateSandboxCallback(ack(), { ...success, resultCode: 1037 }).attempt.state, 'expired')
  assert.equal(evaluateSandboxCallback(ack(), { ...success, resultCode: 1 }).attempt.state, 'failed')
  assert.equal(evaluateSandboxCallback({ ...ack(), state: 'reconciliation_required' }, success).action, 'quarantine')
})
test('conflicting duplicate after settlement is rejected', () => {
  const settled = evaluateSandboxCallback(ack(), success).attempt
  assert.equal(evaluateSandboxCallback(settled, { ...success, receipt: 'OTHER7890' }).action, 'quarantine')
})
test('transport calls sandbox OAuth then STK; till vs PayBill fields', async () => {
  for (const transactionType of ['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'] as const) {
    const calls: Array<{url: string; body?: Record<string, unknown>}> = []
    const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
      calls.push({ url: String(url), body })
      return new Response(JSON.stringify(calls.length === 1
        ? { access_token: 'sandbox-access-token' }
        : { ResponseCode: '0', CheckoutRequestID: 'ws_CO_1234567', MerchantRequestID: 'merchant_12345' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    const payment = await sendUniversalDarajaSandboxStk({
      order: order(), phone: '0712345678', env,
      settings: { ...settings, transactionType, partyB: transactionType === 'CustomerBuyGoodsOnline' ? '555444' : '174379' },
      hasReservedAttempt: async () => true,
      fetcher,
      now: () => new Date('2026-10-22T11:00:00.000Z'),
    })
    assert.equal(payment.state, 'awaiting_customer')
    assert.equal(calls.length, 2)
    for (const call of calls) assert.ok(call.url.startsWith('https://sandbox.safaricom.co.ke/'))
    assert.equal(calls[1].body?.TransactionType, transactionType)
    assert.equal(calls[1].body?.PartyB, transactionType === 'CustomerBuyGoodsOnline' ? '555444' : '174379')
    assert.equal(calls[1].body?.Timestamp, '20261022140000')
    assert.equal(calls[1].body?.Amount, 300)
  }
})
test('provider request never starts if env, phone, callback or reservation are unsafe', async () => {
  let fetchCount = 0
  const fetcher = (async () => { fetchCount++; throw new Error('unexpected fetch') }) as typeof fetch
  const common = { order: order(), phone: '0712345678', env, settings, fetcher, hasReservedAttempt: async () => true }
  for (const altered of [
    { ...common, env: { ...env, VERCEL_ENV: 'production' } },
    { ...common, env: { ...env, MPESA_ENV: 'production' } },
    { ...common, phone: '0712345679' },
    { ...common, settings: { ...settings, callbackUrl: 'https://evil.example.com/callback' } },
    { ...common, hasReservedAttempt: async () => false },
  ]) await assert.rejects(sendUniversalDarajaSandboxStk(altered))
  assert.equal(fetchCount, 0)
})
test('uncertain network error demands reconciliation instead of optimistic retry', async () => {
  const fetcher = (async () => { throw new Error('network dropped') }) as typeof fetch
  await assert.rejects(
    sendUniversalDarajaSandboxStk({ order: order(), phone: '0712345678', env, settings,
      fetcher, hasReservedAttempt: async () => true }),
    /reconciliation/,
  )
})
