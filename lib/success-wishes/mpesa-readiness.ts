// Pure read-only OAuth readiness probe with explicit injected operator permission.
type Config = Record<string, string | undefined>
type Fetcher = typeof fetch
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

export function createPaymentReadinessHandler(options: {
  verifyOperator: (req: Request) => Promise<boolean>
  providerFetch: Fetcher
  env: Config
}) {
  return async (req: Request): Promise<Response> => {
    // Only a signed-in, active HQ founder can request this diagnostic.
    if (!await options.verifyOperator(req)) return reply({ error: 'Forbidden' }, 403)

    const env = options.env
    const configured = Object.fromEntries(
      NAMES.map(name => [name, Boolean(env[name]?.trim())]),
    )
    const destination = {
      environment: env.SUCCESS_WISHES_MPESA_ENV?.trim() || null,
      shortcode: env.SUCCESS_WISHES_MPESA_SHORTCODE?.trim() || null,
      till: env.SUCCESS_WISHES_MPESA_PARTY_B?.trim() || null,
      transactionType: env.SUCCESS_WISHES_MPESA_TRANSACTION_TYPE?.trim() || null,
    }
    const callback = env.SUCCESS_WISHES_MPESA_CALLBACK_URL?.trim()
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

    try {
      const client = env.SUCCESS_WISHES_MPESA_CONSUMER_KEY!.trim()
      const secret = env.SUCCESS_WISHES_MPESA_CONSUMER_SECRET!.trim()
      const response = await options.providerFetch(
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          method: 'GET',
          headers: { Authorization: 'Basic ' + Buffer.from(client + ':' + secret).toString('base64') },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(12000),
        },
      )
      const content: unknown = await response.json()
      const token = content && typeof content === 'object' && 'access_token' in content
        ? (content as Record<string, unknown>).access_token : null
      const oauthVerified = response.ok && typeof token === 'string' && token.length > 8
      return reply({
        configured, destination, callbackConfigured: true, oauthVerified,
        providerHttpStatus: response.status, passkeyVerified: false,
      }, oauthVerified ? 200 : 503)
    } catch {
      return reply({
        configured, destination, callbackConfigured: true, oauthVerified: false,
        reason: 'provider_unreachable_or_invalid_response', passkeyVerified: false,
      }, 503)
    }
  }
}

