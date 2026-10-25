import { createHash, randomBytes } from 'node:crypto'
import { WishError } from './contracts'

// Settles a digital success card from the sandbox commerce status function.
// The status function re-queries Daraja and runs the database reconciliation itself.
// This module only trusts its explicit `simulated_access` result, never a browser claim.
export const STATUS_PATH = '/functions/v1/unified-commerce-sandbox-status'

export type CardStatus = 'pending_payment' | 'paid' | 'failed' | 'expired'

export type CardRow = {
  id: string
  status: CardStatus
  payment_order_id: string | null
}

export type SettlementStore = {
  // Returns true only for the request that moved the card from pending_payment to paid.
  markPaid: (cardId: string, linkTokenHash: string) => Promise<boolean>
  markTerminal: (cardId: string, status: 'failed' | 'expired') => Promise<void>
}

export type SettlementResult = {
  status: CardStatus
  linkToken: string | null
  providerState: string | null
}

type Fetcher = typeof fetch
type Env = Record<string, string | undefined>

export function hashLinkToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function settleCard(
  card: CardRow,
  store: SettlementStore,
  options: { env?: Env; fetcher?: Fetcher } = {},
): Promise<SettlementResult> {
  const env = options.env ?? process.env
  const fetcher = options.fetcher ?? fetch

  if (card.status !== 'pending_payment' || !card.payment_order_id) {
    return { status: card.status, linkToken: null, providerState: null }
  }

  const base = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const operatorToken = env.COMMERCE_SANDBOX_OPERATOR_TOKEN || ''
  if (!base || !operatorToken) {
    throw new WishError(503, 'Payment status is being checked. Please try again shortly.')
  }

  let response: Response
  try {
    response = await fetcher(base + STATUS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + operatorToken },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ order_id: card.payment_order_id }),
    })
  } catch {
    return { status: 'pending_payment', linkToken: null, providerState: null }
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const providerState = typeof payload?.state === 'string' ? payload.state : null

  if (payload?.simulated_access === true && payload.state === 'settled_simulated') {
    // The raw token is returned once and only its hash is stored.
    const linkToken = randomBytes(32).toString('base64url')
    const moved = await store.markPaid(card.id, hashLinkToken(linkToken))
    return { status: 'paid', linkToken: moved ? linkToken : null, providerState }
  }

  if (providerState === 'failed' || providerState === 'cancelled') {
    await store.markTerminal(card.id, 'failed')
    return { status: 'failed', linkToken: null, providerState }
  }
  if (providerState === 'expired') {
    await store.markTerminal(card.id, 'expired')
    return { status: 'expired', linkToken: null, providerState }
  }

  // Anything else (including reconciliation_required) stays pending. Never retry the STK push here.
  return { status: 'pending_payment', linkToken: null, providerState }
}
