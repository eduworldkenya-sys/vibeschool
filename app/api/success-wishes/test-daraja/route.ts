import { NextRequest } from 'next/server'
import { localTestGuard, noStoreJson } from '@/lib/success-wishes/local-test-guard'
import {
  applyHostedSandboxVerdict, attachHostedSandboxOrder, claimHostedSandboxSend,
  markHostedSandboxUncertain, readLocalTestCheckout, startLocalTestCheckout,
} from '@/lib/success-wishes/local-test-store'
import {
  SANDBOX_TEST_PHONE, classifyHostedSandboxStatus, hostedSandboxConfig,
  initiateHostedSandboxStk, queryHostedSandboxStk,
} from '@/lib/success-wishes/hosted-daraja-test'

/**
 * Operator-only browser commissioning. Available only on explicit localhost
 * development and with a private server-side Daraja sandbox operator token.
 * Absolutely never on Vercel / production. The local receipt is a TEST link.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const themes = new Set(['heritage', 'botanical', 'nightfall', 'sunrise'])
const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function gate(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return { blocked }
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host)
        return { blocked: noStoreJson({ error: 'Cross-origin request rejected.' }, 403) }
    } catch {
      return { blocked: noStoreJson({ error: 'Invalid origin.' }, 403) }
    }
  }
  const config = hostedSandboxConfig(process.env)
  if (!config) return { blocked: noStoreJson({ error: 'Hosted sandbox testing disabled.' }, 404) }
  return { config }
}

export async function GET(request: NextRequest) {
  const result = gate(request)
  if (result.blocked) return result.blocked
  return noStoreJson({
    available: true, mode: 'daraja_sandbox',
    amountKes: 50, phoneLast4: SANDBOX_TEST_PHONE.slice(-4),
    simulatedOnly: true, realAccess: false,
  })
}

export async function POST(request: NextRequest) {
  const g = gate(request)
  if (g.blocked) return g.blocked
  const config = g.config!
  let data: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 4000) return noStoreJson({ error: 'Test request too large.' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return noStoreJson({ error: 'Invalid test request.' }, 400)
    data = parsed as Record<string, unknown>
  } catch { return noStoreJson({ error: 'Invalid test request.' }, 400) }

  if (data.action === 'prepare') {
    const candidate = clean(data.candidate, 48)
    const sender = clean(data.sender, 48)
    const message = clean(data.message, 220)
    const examYear = clean(data.examYear, 4)
    const school = clean(data.school, 80)
    const theme = clean(data.theme, 20)
    const phone = clean(data.phone, 25).replace(/[\s()+-]/g, '')
      .replace(/^0/, '254')
    if (!candidate || !sender || !message || !/^20\d{2}$/.test(examYear) ||
      !themes.has(theme) || data.version !== 'text' ||
      phone !== SANDBOX_TEST_PHONE || data.amountKes !== undefined ||
      data.amount_kes !== undefined || data.price !== undefined)
      return noStoreJson({ error: 'Use the approved KES 50 text card and sandbox test phone.' }, 400)
    const local = await startLocalTestCheckout({
      candidate, sender, message, examYear, school, theme,
      phoneLast4: SANDBOX_TEST_PHONE.slice(-4),
    }, 'daraja')
    return noStoreJson({
      mode: 'daraja_sandbox', simulated: true, realAccess: false,
      ...local, state: 'prepared',
    }, 201)
  }

  const orderId = clean(data.orderId, 60)
  const key = clean(data.key, 80)
  const local = await readLocalTestCheckout(orderId, key)
  if (!local || local.providerMode !== 'daraja')
    return noStoreJson({ error: 'Unknown or expired sandbox test order.' }, 404)

  if (data.action === 'start') {
    if (!await claimHostedSandboxSend(orderId, key))
      return noStoreJson({
        error: 'Sandbox STK already started or outcome uncertain. Do not retry.',
        state: local.hostedState, realAccess: false,
      }, 409)
    try {
      const hosted = await initiateHostedSandboxStk({
        localOrderId: orderId, phone: SANDBOX_TEST_PHONE,
        guestReference: 'guest_browser_' + orderId.replace(/-/g, ''),
      }, config)
      if (!await attachHostedSandboxOrder(
        orderId, key, hosted.orderId, hosted.checkoutRequestId
      )) throw new Error('Could not attach hosted order')
      return noStoreJson({
        mode: 'daraja_sandbox', state: 'awaiting_customer',
        orderId, amountKes: 50, simulated: true, realAccess: false,
        checkoutRequestId: hosted.checkoutRequestId,
      }, 202)
    } catch {
      await markHostedSandboxUncertain(orderId, key)
      return noStoreJson({
        mode: 'daraja_sandbox', state: 'outcome_unknown',
        error: 'STK outcome uncertain. No second push will be sent. Operator reconciliation required.',
        realAccess: false,
      }, 409)
    }
  }

  if (data.action === 'status') {
    if (!local.hostedOrderId) return noStoreJson({
      mode: 'daraja_sandbox', orderId, state: local.hostedState || 'prepared',
      realAccess: false, simulated: true,
      message: 'No attached STK order. Cannot query or safely retry.',
    })
    if (local.state !== 'awaiting_test_result') return noStoreJson({
      mode: 'daraja_sandbox', orderId, state: local.state,
      simulated: true, realAccess: false,
      message: 'This test order was already resolved.',
    })
    try {
      const observed = await queryHostedSandboxStk(local.hostedOrderId, config)
      const verdict = classifyHostedSandboxStatus(observed)
      const result = await applyHostedSandboxVerdict(
        orderId, key, local.hostedOrderId, verdict
      )
      if (!result) throw new Error('Unmatched sandbox payment record')
      return noStoreJson({
        mode: 'daraja_sandbox', orderId, simulated: true, realAccess: false,
        state: result.state,
        processingVerdict: observed.processing_verdict || null,
        providerResultCode: observed.provider_result_code ?? null,
        invitationToken: 'invitationToken' in result ? result.invitationToken : null,
      })
    } catch {
      return noStoreJson({
        mode: 'daraja_sandbox', orderId, state: 'reconciliation_required',
        simulated: true, realAccess: false,
        error: 'Provider status could not be verified. You may check status again; never resend STK.',
      }, 409)
    }
  }

  return noStoreJson({ error: 'Unsupported sandbox test action.' }, 400)
}
