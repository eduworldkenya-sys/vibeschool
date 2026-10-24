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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A temporary 409 STATUS response is not settlement or definitive failure.
// Never apply this exception to checkout, different orders or unsafe evidence.
export function isPendingReconciliation409(httpStatus, reply, orderId) {
  return httpStatus === 409 &&
    reply?.mode === 'sandbox' && reply?.order_id === orderId &&
    UUID.test(orderId) &&
    reply?.state === 'reconciliation_required' &&
    reply?.simulated_access === false && reply?.real_access === false &&
    ['provider_query', 'persist_provider_observation',
      'database_reconciliation'].includes(reply?.failure_stage) &&
    !['provider_identity_mismatch', 'provider_auth_or_configuration',
      'provider_response_invalid'].includes(reply?.failure_code)
}

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
    if (endpoint === 'unified-commerce-sandbox-status' &&
        isPendingReconciliation409(response.status, reply, body.order_id))
      return { ...reply, status_check_pending: true }
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
  // A new order every time, using the EXISTING trusted sandbox catalogue
  // item. The unique owner + idempotency key identifies the fresh purchase;
  // never use a fake item_reference or repeat an uncertain STK POST.
  const checkout = await apiPost('unified-commerce-sandbox-checkout', {
    product_kind: 'success_wish',
    item_reference: 'sandbox-success-wish',
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
    if (status.status_check_pending) {
      log(`Temporary reconciliation error for order ${orderId}; checking STATUS only, no new STK`)
      continue
    }
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

/** Query an existing order exactly once; never call checkout or initiate STK. */
export async function checkHostedExistingOrder(options) {
  const { token } = validateProofEnvironment(options.env)
  const orderId = options.orderId
  if (typeof orderId !== 'string' || !UUID.test(orderId))
    throw new Error('Supply a valid existing sandbox order UUID')
  const fetcher = options.fetcher || fetch
  const status = await apiPost('unified-commerce-sandbox-status', {
    order_id: orderId,
  }, token, fetcher)
  if (status.order_id !== orderId)
    throw new Error('Status response references the wrong order')
  const verdict = status.status_check_pending ? 'waiting' : classifyProofStatus(status)
  if (verdict === 'invalid')
    throw new Error('Invalid or contradictory hosted sandbox status')
  return { orderId, verdict, status }
}

if (process.argv[1] && fileURLToPath(import.meta.url) ===
    (await import('node:path')).resolve(process.argv[1])) {
  const statusOnly = process.argv.indexOf('--status-only')
  if (statusOnly !== -1) {
    // Prevent accidental checkout from mixed flags or invalid arguments.
    if (process.argv.includes('--execute') || statusOnly !== process.argv.length - 2) {
      console.error('Use --status-only <existing-order-uuid> without --execute')
      process.exitCode = 1
    } else {
      checkHostedExistingOrder({ env: process.env, orderId: process.argv[statusOnly + 1] })
        .then(({ orderId, verdict, status }) => {
          console.log(`STATUS ONLY: order ${orderId}: ${verdict}; state=${status.state}; provider_result_code=${status.provider_result_code ?? 'unknown'}; simulated_access=${status.simulated_access}; real_access=${status.real_access}; no STK sent`)
        }).catch(error => {
          console.error('STATUS ERROR:', error.message)
          process.exitCode = 1
        })
    }
  } else if (!process.argv.includes('--execute')) {
    console.log('Operator-only hosted sandbox proof. No request made.')
    console.log('Set COMMERCE_SANDBOX_OPERATOR_TOKEN and COMMERCE_SANDBOX_TEST_PHONE privately.')
    console.log('Inspect existing order: node scripts/commerce/hosted-daraja-sandbox-proof.mjs --status-only <uuid>')
    console.log('New STK only: node scripts/commerce/hosted-daraja-sandbox-proof.mjs --execute')
  } else {
    runHostedProof({ env: process.env }).catch(error => {
      console.error('FAIL:', error.message)
      process.exitCode = 1
    })
  }
}
