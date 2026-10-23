/**
 * Local operator bridge to the existing ISOLATED Daraja sandbox functions.
 *
 * Only server-side code may import/call this module. Never send the operator
 * token to a browser or use the production Supabase project. No retries for
 * STK submissions; only the separately authenticated status query is safe.
 */
export const SANDBOX_ORIGIN = 'https://ufqjgyzspavamdpkdxmc.supabase.co/functions/v1'
export const SANDBOX_TEST_PHONE = '254708374149'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STK_ID = /^ws_CO_[A-Za-z0-9_:-]{12,}$/

export type HostedStatus = {
  mode: 'sandbox'
  order_id: string
  state: string
  processing_verdict?: string
  simulated_access: boolean
  real_access: false
  provider_result_code?: number
  failure_stage?: string
}

export function hostedSandboxConfig(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'development' ||
      env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE !== '1' ||
      env.VIBESCHOOL_DARAJA_HOSTED_TEST_ENABLED !== '1' ||
      !!env.VERCEL_ENV ||
      env.MPESA_ENV !== 'sandbox' ||
      (env.COMMERCE_SANDBOX_PROJECT_REF && env.COMMERCE_SANDBOX_PROJECT_REF !== 'ufqjgyzspavamdpkdxmc') ||
      (env.COMMERCE_SANDBOX_TEST_PHONE && env.COMMERCE_SANDBOX_TEST_PHONE !== SANDBOX_TEST_PHONE) ||
      env.NEXT_PUBLIC_COMMERCE_SANDBOX_OPERATOR_TOKEN) return null
  const token = env.COMMERCE_SANDBOX_OPERATOR_TOKEN || ''
  if (token.length < 32 || token.length > 256 || !/^[\x21-\x7e]+$/.test(token)) return null
  return { token }
}

function safeStatus(result: unknown): result is HostedStatus {
  if (!result || typeof result !== 'object') return false
  const s = result as Record<string, unknown>
  return s.mode === 'sandbox' && typeof s.order_id === 'string' &&
    UUID.test(s.order_id) && typeof s.state === 'string' &&
    s.real_access === false && typeof s.simulated_access === 'boolean'
}

async function callHosted(path: 'checkout' | 'status', body: object,
  token: string, fetcher: typeof fetch) {
  const endpoint = path === 'checkout'
    ? 'unified-commerce-sandbox-checkout'
    : 'unified-commerce-sandbox-status'
  const response = await fetcher(SANDBOX_ORIGIN + '/' + endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  const data: unknown = await response.json()
  if (!response.ok) throw new Error('Daraja sandbox ' + path + ' status HTTP ' + response.status)
  if (!data || typeof data !== 'object') throw new Error('Invalid Daraja sandbox reply')
  return data
}

export async function initiateHostedSandboxStk(
  args: { localOrderId: string; phone: string; guestReference: string },
  config: { token: string }, fetcher: typeof fetch = fetch
) {
  if (!UUID.test(args.localOrderId) || args.phone !== SANDBOX_TEST_PHONE ||
    !/^[a-zA-Z0-9_:-]{6,100}$/.test(args.guestReference))
    throw new Error('Unsupported sandbox test checkout')
  const nonce = args.localOrderId.replace(/-/g, '')
  const data = await callHosted('checkout', {
    product_kind: 'success_wish', item_reference: 'sandbox-success-wish',
    owner_type: 'guest', owner_reference: args.guestReference,
    idempotency_key: 'browser_test_' + nonce, phone: SANDBOX_TEST_PHONE,
  }, config.token, fetcher) as Record<string, unknown>
  if (data.mode !== 'sandbox' || data.amount_kes !== 50 ||
    data.state !== 'awaiting_customer' || !UUID.test(String(data.order_id || '')) ||
    !STK_ID.test(String(data.checkout_request_id || '')))
    throw new Error('Unverified Daraja sandbox STK acknowledgement')
  return {
    mode: 'sandbox' as const,
    orderId: String(data.order_id),
    checkoutRequestId: String(data.checkout_request_id),
    amountKes: 50 as const,
    state: 'awaiting_customer' as const,
    realAccess: false as const,
  }
}

export async function queryHostedSandboxStk(
  orderId: string, config: { token: string }, fetcher: typeof fetch = fetch
): Promise<HostedStatus> {
  if (!UUID.test(orderId)) throw new Error('Invalid sandbox order id')
  const data = await callHosted('status', { order_id: orderId }, config.token, fetcher)
  if (!safeStatus(data) || data.order_id !== orderId)
    throw new Error('Mismatched sandbox payment status')
  const response = data as HostedStatus
  if (response.state === 'settled_simulated' && !response.simulated_access)
    throw new Error('Sandbox settlement lacks exactly one simulated grant')
  if (response.state !== 'settled_simulated' && response.simulated_access)
    throw new Error('Unexpected simulated grant before sandbox settlement')
  return response
}

export function classifyHostedSandboxStatus(status: HostedStatus) {
  if (status.state === 'settled_simulated' && status.simulated_access &&
    status.real_access === false) return 'success' as const
  if (status.processing_verdict === 'expired' ||
    status.state === 'expired') return 'expired' as const
  if (status.processing_verdict === 'cancelled' ||
    status.state === 'cancelled') return 'cancelled' as const
  if (status.processing_verdict === 'failed' ||
    status.state === 'failed') return 'failed' as const
  if (status.simulated_access || status.real_access !== false)
    throw new Error('Invalid provider access state')
  return 'pending' as const
}
