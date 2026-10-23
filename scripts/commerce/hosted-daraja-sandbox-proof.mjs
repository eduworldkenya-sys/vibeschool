/**
 * Operator-only HOSTED Daraja sandbox proof for one fresh KES 50 Success Wish.
 *
 * This never talks to production, never sends a second STK request and never
 * grants real access. Real Daraja sandbox credentials must already exist as
 * isolated Supabase function secrets; this CLI only requires the operator
 * token and approved simulator number.
 *
 * Usage (do NOT paste token into shell history):
 *   export COMMERCE_SANDBOX_OPERATOR_TOKEN=...
 *   export COMMERCE_SANDBOX_TEST_PHONE=2547...
 *   node scripts/commerce/hosted-daraja-sandbox-proof.mjs --execute
 */
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const PROJECT_REF = 'ufqjgyzspavamdpkdxmc'
export const FUNCTION_ORIGIN =
  `https://${PROJECT_REF}.supabase.co/functions/v1`
const INTERVAL_MS = 5000
const MAX_POLLS = 30

export function validateProofEnvironment(env) {
  if (env.COMMERCE_SANDBOX_PROJECT_REF &&
      env.COMMERCE_SANDBOX_PROJECT_REF !== PROJECT_REF)
    throw new Error('Refusing an unexpected Supabase project reference')
  const token = env.COMMERCE_SANDBOX_OPERATOR_TOKEN || ''
  const phone = env.COMMERCE_SANDBOX_TEST_PHONE || ''
  if (!/^[A-Za-z0-9_\-!@#$%^&*+=:]{32,256}$/.test(token))
    throw new Error('Set a valid COMMERCE_SANDBOX_OPERATOR_TOKEN privately')
  if (!/^254[17]\d{8}$/.test(phone))
    throw new Error('Set the authorised Daraja simulator phone in 254 format')
  return { token, phone }
}

export function classifyProofStatus(s) {
  if (!s || s.mode !== 'sandbox' || s.real_access !== false)
    return 'invalid'
  if (s.state === 'settled_simulated' &&
      s.simulated_access === true) return 'passed'
  const outcome = s.processing_verdict || s.state
  if (['expired', 'cancelled', 'failed'].includes(outcome)) return 'failed'
  if (s.simulated_access === true) return 'invalid'
  if (['created', 'awaiting_customer', 'reconciliation_required',
       'query_pending', 'awaiting_callback_evidence',
       'early_event_waiting_for_attachment', 'submitting'].includes(outcome))
    return 'waiting'
  return 'invalid'
}

async function apiPost(endpoint, body, token, fetcher) {
  // Only these two pinned isolated functions may be contacted.
  if (!['unified-commerce-sandbox-checkout',
         'unified-commerce-sandbox-status'].includes(endpoint))
    throw new Error('Refusing unknown sandbox endpoint')
  const response = await fetcher(`${FUNCTION_ORIGIN}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
    cache: 'no-store',
  })
  let reply
  try { reply = await response.json() }
  catch { throw new Error(`${endpoint}: malformed JSON response`) }
  if (!response.ok) {
    const safeState = typeof reply?.state === 'string'
      ? reply.state : `HTTP ${response.status}`
    throw new Error(`${endpoint}: ${safeState} (${response.status})`)
  }
  return reply
}

export async function runHostedProof(options) {
  const { token, phone } = validateProofEnvironment(options.env)
  const fetcher = options.fetcher || fetch
  const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const log = options.log || console.log

  const nonce = randomUUID().replace(/-/g, '')
  // A new order every time. Never reuse an old simulation or reuse a
  // checkout idempotency key; never retry an uncertain STK POST.
  const checkout = await apiPost('unified-commerce-sandbox-checkout', {
    product_kind: 'success_wish',
    item_reference: `wish_proof_${nonce}`,
    owner_type: 'guest',
    owner_reference: `guest_${nonce}`,
    idempotency_key: `sbproof_${nonce}`,
    phone,
  }, token, fetcher)

  if (checkout.mode !== 'sandbox' ||
      checkout.state !== 'awaiting_customer' ||
      checkout.amount_kes !== 50 ||
      !/^[0-9a-f-]{36}$/i.test(checkout.order_id || '') ||
      typeof checkout.checkout_request_id !== 'string')
    throw new Error('STK acknowledgement was not a valid KES 50 sandbox order')

  const orderId = checkout.order_id
  log(`KES 50 sandbox STK acknowledged for new order ${orderId}; NOT yet paid`)
  let status
  for (let i = 0; i < MAX_POLLS; i++) {
    await pause(INTERVAL_MS)
    // Polling STATUS is safe. It never re-initiates the STK request.
    status = await apiPost('unified-commerce-sandbox-status', {
      order_id: orderId,
    }, token, fetcher)
    if (status.order_id !== orderId)
      throw new Error('Status response references the wrong order')
    const verdict = classifyProofStatus(status)
    if (verdict === 'passed') {
      log(`PASS: fresh KES 50 sandbox order ${orderId} settled with exactly one SIMULATED access grant; no real access`)
      return { orderId, verdict, status }
    }
    if (verdict === 'failed')
      throw new Error(`Provider did not complete payment: ${status.processing_verdict || status.state}`)
    if (verdict === 'invalid')
      throw new Error('Invalid or contradictory hosted sandbox status')
  }
  throw new Error(`Sandbox STK outcome not confirmed after ${MAX_POLLS} status checks; order ${orderId} needs reconciliation. Do not retry the checkout.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) ===
    (await import('node:path')).resolve(process.argv[1])) {
  if (!process.argv.includes('--execute')) {
    console.log('Operator-only hosted sandbox proof. No request made.')
    console.log('Set COMMERCE_SANDBOX_OPERATOR_TOKEN and COMMERCE_SANDBOX_TEST_PHONE privately.')
    console.log('Then run: node scripts/commerce/hosted-daraja-sandbox-proof.mjs --execute')
  } else {
    runHostedProof({ env: process.env }).catch(error => {
      console.error('FAIL:', error.message)
      process.exitCode = 1
    })
  }
}
