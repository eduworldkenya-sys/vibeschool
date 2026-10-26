// Operator-only, read-only Safaricom credential check. Never initiates an STK request.
// SECURITY: deploy with verify_jwt=true. The Supabase gateway cryptographically validates
// the Authorization JWT before the handler runs; the handler then checks its privilege.
function serviceRoleFromGatewayVerifiedJwt(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  const token = header.slice(7).trim()
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some(part => !part)) return false
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(encoded))
    return claims?.role === 'service_role' &&
      typeof claims.exp === 'number' &&
      Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })

  if (req.method !== 'GET') return reply({ error: 'Method not allowed', stkSent: false }, 405)
  if (!serviceRoleFromGatewayVerifiedJwt(req)) {
    return reply({ error: 'Unauthorized', reason: 'verified_service_role_jwt_required', stkSent: false }, 401)
  }

  const names = [
    'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY',
    'MPESA_SHORTCODE', 'MPESA_PARTY_B', 'MPESA_TRANSACTION_TYPE', 'MPESA_ENV',
  ]
  const configured = Object.fromEntries(names.map(n => [n, Boolean(Deno.env.get(n)?.trim())]))
  const destination = {
    shortcode: Deno.env.get('MPESA_SHORTCODE')?.trim() || null,
    till: Deno.env.get('MPESA_PARTY_B')?.trim() || null,
    transactionType: Deno.env.get('MPESA_TRANSACTION_TYPE')?.trim() || null,
    environment: Deno.env.get('MPESA_ENV')?.trim() || null,
  }
  if (destination.environment !== 'production' || destination.shortcode !== '961580' ||
    destination.till !== '949529' || destination.transactionType !== 'CustomerBuyGoodsOnline' ||
    Object.values(configured).some(v => !v)) {
    return reply({ configured, destination, oauthVerified: false, stkSent: false,
      reason: 'configuration_incomplete_or_destination_mismatch' }, 503)
  }

  try {
    const response = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        Authorization: 'Basic ' + btoa(
          Deno.env.get('MPESA_CONSUMER_KEY')!.trim() + ':' +
          Deno.env.get('MPESA_CONSUMER_SECRET')!.trim(),
        ),
      },
      redirect: 'error', signal: AbortSignal.timeout(12000),
    })
    const data = await response.json()
    const ok = response.ok && typeof data.access_token === 'string' && data.access_token.length > 8
    return reply({ configured, destination, oauthVerified: ok, providerHttpStatus: response.status,
      passkeyVerified: false, stkSent: false }, ok ? 200 : 503)
  } catch {
    return reply({ configured, destination, oauthVerified: false,
      reason: 'provider_unreachable', stkSent: false }, 503)
  }
})
