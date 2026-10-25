import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { settleCard, hashLinkToken, STATUS_PATH, type CardRow, type SettlementStore } from './settlement'
import { WishError } from './contracts'

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://ufqjgyzspavamdpkdxmc.supabase.co/',
  COMMERCE_SANDBOX_OPERATOR_TOKEN: 'operator-test-token-0123456789abcdef',
}
const pending: CardRow = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'pending_payment',
  payment_order_id: '22222222-2222-4222-8222-222222222222',
}

function fakeStore(markPaidResult = true) {
  const calls: { paid: Array<[string, string]>; terminal: Array<[string, string]> } = { paid: [], terminal: [] }
  const store: SettlementStore = {
    async markPaid(cardId, hash) { calls.paid.push([cardId, hash]); return markPaidResult },
    async markTerminal(cardId, status) { calls.terminal.push([cardId, status]) },
  }
  return { store, calls }
}

function providerReply(body: unknown, status = 200) {
  const seen: { url?: string; init?: RequestInit } = {}
  const fetcher = (async (url: string, init?: RequestInit) => {
    seen.url = url
    seen.init = init
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { fetcher, seen }
}

test('a card that is not pending never calls the provider', async () => {
  const { store, calls } = fakeStore()
  let called = false
  const fetcher = (async () => { called = true; return new Response('{}') }) as typeof fetch
  const result = await settleCard({ ...pending, status: 'paid' }, store, { env: ENV, fetcher })
  assert.equal(result.status, 'paid')
  assert.equal(called, false)
  assert.equal(calls.paid.length, 0)
})

test('a pending card without an order id is not settled', async () => {
  const { store, calls } = fakeStore()
  const result = await settleCard({ ...pending, payment_order_id: null }, store, { env: ENV })
  assert.equal(result.status, 'pending_payment')
  assert.equal(calls.paid.length, 0)
})

test('settles only on explicit simulated access and returns a one-time link whose hash is stored', async () => {
  const { store, calls } = fakeStore(true)
  const { fetcher, seen } = providerReply({ state: 'settled_simulated', simulated_access: true, real_access: false })
  const result = await settleCard(pending, store, { env: ENV, fetcher })

  assert.equal(result.status, 'paid')
  assert.ok(result.linkToken && result.linkToken.length >= 40)
  assert.equal(calls.paid.length, 1)
  assert.equal(calls.paid[0][0], pending.id)
  assert.equal(calls.paid[0][1], createHash('sha256').update(result.linkToken!).digest('hex'))
  assert.equal(calls.paid[0][1], hashLinkToken(result.linkToken!))

  assert.equal(seen.url, 'https://ufqjgyzspavamdpkdxmc.supabase.co' + STATUS_PATH)
  assert.equal(seen.init?.redirect, 'error')
  assert.equal((seen.init?.headers as Record<string, string>).Authorization, 'Bearer ' + ENV.COMMERCE_SANDBOX_OPERATOR_TOKEN)
  assert.deepEqual(JSON.parse(String(seen.init?.body)), { order_id: pending.payment_order_id })
})

test('a concurrent settlement that loses the race returns no second link', async () => {
  const { store } = fakeStore(false)
  const { fetcher } = providerReply({ state: 'settled_simulated', simulated_access: true })
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(result.status, 'paid')
  assert.equal(result.linkToken, null)
})

test('simulated_access alone without the settled state never marks the card paid', async () => {
  const { store, calls } = fakeStore()
  const { fetcher } = providerReply({ state: 'awaiting_customer', simulated_access: true })
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(result.status, 'pending_payment')
  assert.equal(result.linkToken, null)
  assert.equal(calls.paid.length, 0)
})

test('provider reconciliation still in progress keeps the card pending', async () => {
  const { store, calls } = fakeStore()
  const { fetcher } = providerReply({ state: 'reconciliation_required', simulated_access: false, real_access: false })
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(result.status, 'pending_payment')
  assert.equal(result.providerState, 'reconciliation_required')
  assert.equal(calls.paid.length + calls.terminal.length, 0)
})

test('a provider failure marks the card failed, not paid', async () => {
  const { store, calls } = fakeStore()
  const { fetcher } = providerReply({ state: 'failed', simulated_access: false })
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(result.status, 'failed')
  assert.deepEqual(calls.terminal, [[pending.id, 'failed']])
  assert.equal(calls.paid.length, 0)
})

test('a transport failure leaves the card pending for a later retry', async () => {
  const { store, calls } = fakeStore()
  const fetcher = (async () => { throw new Error('network down') }) as typeof fetch
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(result.status, 'pending_payment')
  assert.equal(calls.paid.length + calls.terminal.length, 0)
})

test('missing operator configuration refuses before any provider call', async () => {
  const { store } = fakeStore()
  let called = false
  const fetcher = (async () => { called = true; return new Response('{}') }) as typeof fetch
  await assert.rejects(
    settleCard(pending, store, { env: { NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL }, fetcher }),
    (error: unknown) => error instanceof WishError && error.status === 503,
  )
  assert.equal(called, false)
})

test('the operator token never appears in the settlement result', async () => {
  const { store } = fakeStore()
  const { fetcher } = providerReply({ state: 'settled_simulated', simulated_access: true })
  const result = await settleCard(pending, store, { env: ENV, fetcher })
  assert.equal(JSON.stringify(result).includes(ENV.COMMERCE_SANDBOX_OPERATOR_TOKEN), false)
})
