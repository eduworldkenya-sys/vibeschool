// Read-only, operator-only production Daraja OAuth diagnostic.
// This route never creates a charge, STK prompt, card or payment state.
// Production credentials are isolated to Vercel and never returned to callers.
import { createHash, timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NAMES = [
  'SUCCESS_WISHES_MPESA_CONSUMER_KEY',
  'SUCCESS_WISHES_MPESA_CONSUMER_SECRET',
  'SUCCESS_WISHES_MPESA_PASSKEY',
  'SUCCESS_WISHES_MPESA_SHORTCODE',
  'SUCCESS_WISHES_MPESA_PARTY_B',
  'SUCCESS_WISHES_MPESA_TRANSACTION_TYPE',
  'SUCCESS_WISHES_MPESA_ENV',
  'SUCCESS_WISHES_MPESA_CALLBACK_URL',
] as const
const CALLBACK =
  'https://yauqsxggtuxuykcbrtzf.supabase.co/functions/v1/success-wishes-mpesa-callback'

function reply(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, stkSent: false }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function authorized(req: Request) {
  // Deliberately do NOT accept an anon key, an ordinary user JWT, a cookie,
  // or an arbitrary token claiming role=service_role without exact secret equality.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const provided = req.headers.get('authorization')
  if (!key || !provided?.startsWith('Bearer ')) return false
  const expectedDigest = createHash('sha256').update('Bearer ' + key).digest()
  const suppliedDigest = createHash('sha256').update(provided).digest()
  return timingSafeEqual(expectedDigest, suppliedDigest)
}

export async function GET(req: Request) {
  if (!authorized(req)) return reply({ error: 'Unauthorized' }, 401)

  const configured = Object.fromEntries(
    NAMES.map(name => [name, Boolean(process.env[name]?.trim())]),
  )
  const destination = {
    environment: process.env.SUCCESS_WISHES_MPESA_ENV?.trim() || null,
    shortcode: process.env.SUCCESS_WISHES_MPESA_SHORTCODE?.trim() || null,
    till: process.env.SUCCESS_WISHES_MPESA_PARTY_B?.trim() || null,
    transactionType: process.env.SUCCESS_WISHES_MPESA_TRANSACTION_TYPE?.trim() || null,
  }
  const callback = process.env.SUCCESS_WISHES_MPESA_CALLBACK_URL?.trim()
  if (
    Object.values(configured).some(ready => !ready) ||
    destination.environment !== 'production' ||
    destination.shortcode !== '961580' ||
    destination.till !== '949529' ||
    destination.transactionType !== 'CustomerBuyGoodsOnline' ||
    callback !== CALLBACK
  ) {
    return reply({
      configured,
      destination,
      callbackConfigured: callback === CALLBACK,
      oauthVerified: false,
      reason: 'configuration_incomplete_or_destination_mismatch',
    }, 503)
  }

  // OAuth only: no STK request, no state mutations, no card issuance.
  try {
    const client = process.env.SUCCESS_WISHES_MPESA_CONSUMER_KEY!.trim()
    const secret = process.env.SUCCESS_WISHES_MPESA_CONSUMER_SECRET!.trim()
    const response = await fetch(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        method: 'GET',
        headers: { Authorization: 'Basic ' + Buffer.from(client + ':' + secret).toString('base64') },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      },
    )
    // Never return or log a provider-issued access token or a secret.
    const content: unknown = await response.json()
    const token = content && typeof content === 'object' && 'access_token' in content
      ? (content as Record<string, unknown>).access_token : null
    const oauthVerified = response.ok && typeof token === 'string' && token.length > 8
    return reply({
      configured,
      destination,
      callbackConfigured: true,
      oauthVerified,
      providerHttpStatus: response.status,
      passkeyVerified: false,
    }, oauthVerified ? 200 : 503)
  } catch {
    return reply({
      configured,
      destination,
      callbackConfigured: true,
      oauthVerified: false,
      reason: 'provider_unreachable_or_invalid_response',
      passkeyVerified: false,
    }, 503)
  }
}
