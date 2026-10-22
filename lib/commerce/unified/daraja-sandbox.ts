/**
 * Universal Daraja STK sandbox transport. Not routed from a production endpoint.
 * Hardcoded sandbox host and explicit env gate make live charging impossible here.
 * The returned STK acknowledgement is NOT a paid or fulfilled order.
 */
import {
  assertDarajaSandboxOnly, normalizeKenyanPhone, recordSandboxAcknowledgement,
  type SandboxOrder, type SandboxAttempt,
} from './sandbox'

export type DarajaSandboxSettings = {
  consumerKey: string
  consumerSecret: string
  passkey: string
  businessShortCode: string
  partyB: string
  transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline'
  callbackUrl: string
  /** Explicit simulator number from Daraja test credentials; never real customers. */
  testPhone: string
}

type Fetcher = typeof fetch
const SANDBOX_HOST = 'https://sandbox.safaricom.co.ke'
const PROVIDER_REF = /^[a-zA-Z0-9_:-]{6,160}$/

function validated(settings: DarajaSandboxSettings) {
  if (!settings.consumerKey?.trim() || !settings.consumerSecret?.trim()
    || !settings.passkey?.trim()
    || !/^\d{5,7}$/.test(settings.businessShortCode)
    || !/^\d{5,10}$/.test(settings.partyB)
    || !['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'].includes(settings.transactionType)
    || (settings.transactionType === 'CustomerPayBillOnline'
      && settings.partyB !== settings.businessShortCode)) {
    throw new Error('Invalid Daraja sandbox configuration')
  }
  const callback = new URL(settings.callbackUrl)
  if (callback.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(callback.hostname)
    || callback.port || callback.username || callback.password
    || callback.search || callback.hash
    || callback.pathname !== '/functions/v1/unified-commerce-sandbox-callback') {
    throw new Error('Sandbox callback must be a dedicated HTTPS Supabase endpoint')
  }
  return { ...settings, testPhone: normalizeKenyanPhone(settings.testPhone) }
}

async function providerJson(fetcher: Fetcher, path: string, init: RequestInit) {
  let response: Response
  try {
    response = await fetcher(SANDBOX_HOST + path, {
      ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    })
  } catch {
    throw new Error('Daraja sandbox outcome uncertain; do not retry without reconciliation')
  }
  if (!response.ok) throw new Error('Daraja sandbox rejected the request')
  const value: unknown = await response.json().catch(() => null)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Daraja sandbox response')
  }
  return value as Record<string, unknown>
}

export async function sendUniversalDarajaSandboxStk(input: {
  order: SandboxOrder
  phone: string
  settings: DarajaSandboxSettings
  env: Record<string, string | undefined>
  /** Only use for an already-durably-reserved order/attempt, in nonproduction. */
  hasReservedAttempt: () => Promise<boolean>
  fetcher?: Fetcher
  now?: () => Date
}): Promise<SandboxAttempt> {
  assertDarajaSandboxOnly(input.env)
  const settings = validated(input.settings)
  if (input.order.mode !== 'sandbox' || input.order.state !== 'created'
    || !Number.isSafeInteger(input.order.amountKes)
    || input.order.amountKes < 1 || input.order.amountKes > 250000) {
    throw new Error('Invalid sandbox order')
  }
  const phone = normalizeKenyanPhone(input.phone)
  if (phone !== settings.testPhone) throw new Error('Only the approved sandbox test phone is allowed')
  if (await input.hasReservedAttempt() !== true) {
    throw new Error('A durable sandbox attempt must be reserved before transport')
  }
  const fetcher = input.fetcher || fetch
  const oauth = await providerJson(fetcher, '/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: { Authorization: 'Basic ' + btoa(settings.consumerKey + ':' + settings.consumerSecret) },
  })
  if (typeof oauth.access_token !== 'string' || oauth.access_token.length < 8) {
    throw new Error('Daraja sandbox OAuth failed')
  }
  const currentTime = input.now?.() || new Date()
  if (!Number.isFinite(currentTime.getTime())) throw new Error('Invalid clock')
  const timestamp = new Date(currentTime.getTime() + 3 * 3600000)
    .toISOString().replace(/\D/g, '').slice(0, 14)
  const password = btoa(settings.businessShortCode + settings.passkey + timestamp)
  const accountReference = input.order.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  if (!accountReference) throw new Error('Invalid order reference')
  const stk = await providerJson(fetcher, '/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + oauth.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: settings.businessShortCode, Password: password, Timestamp: timestamp,
      TransactionType: settings.transactionType, Amount: input.order.amountKes,
      PartyA: phone, PartyB: settings.partyB, PhoneNumber: phone,
      CallBackURL: settings.callbackUrl, AccountReference: accountReference,
      TransactionDesc: 'VibeSchool',
    }),
  })
  if (stk.ResponseCode !== '0' || typeof stk.CheckoutRequestID !== 'string'
    || !PROVIDER_REF.test(stk.CheckoutRequestID)
    || typeof stk.MerchantRequestID !== 'string'
    || !PROVIDER_REF.test(stk.MerchantRequestID)) {
    throw new Error('Daraja did not acknowledge STK; reconcile before retrying')
  }
  return recordSandboxAcknowledgement(input.order, phone, {
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
  })
}
