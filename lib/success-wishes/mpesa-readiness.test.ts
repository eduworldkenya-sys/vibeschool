import test from 'node:test'
import assert from 'node:assert/strict'
import { GET } from '../../app/api/success-wishes/mpesa-readiness/route'

const names = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUCCESS_WISHES_MPESA_CONSUMER_KEY',
  'SUCCESS_WISHES_MPESA_CONSUMER_SECRET',
  'SUCCESS_WISHES_MPESA_PASSKEY',
  'SUCCESS_WISHES_MPESA_SHORTCODE',
  'SUCCESS_WISHES_MPESA_PARTY_B',
  'SUCCESS_WISHES_MPESA_TRANSACTION_TYPE',
  'SUCCESS_WISHES_MPESA_ENV',
  'SUCCESS_WISHES_MPESA_CALLBACK_URL',
]
const good = {
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-only',
  SUCCESS_WISHES_MPESA_CONSUMER_KEY: 'consumer',
  SUCCESS_WISHES_MPESA_CONSUMER_SECRET: 'secret',
  SUCCESS_WISHES_MPESA_PASSKEY: 'passkey',
  SUCCESS_WISHES_MPESA_SHORTCODE: '961580',
  SUCCESS_WISHES_MPESA_PARTY_B: '949529',
  SUCCESS_WISHES_MPESA_TRANSACTION_TYPE: 'CustomerBuyGoodsOnline',
  SUCCESS_WISHES_MPESA_ENV: 'production',
  SUCCESS_WISHES_MPESA_CALLBACK_URL:
    'https://yauqsxggtuxuykcbrtzf.supabase.co/functions/v1/success-wishes-mpesa-callback',
}
const request = (key = good.SUPABASE_SERVICE_ROLE_KEY) => new Request(
  'https://vibeschool.co.ke/api/success-wishes/mpesa-readiness',
  { headers: { Authorization: 'Bearer ' + key } },
)
async function setup(values: Record<string, string>, run: () => Promise<void>) {
  const originals = Object.fromEntries(names.map(key => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  try {
    for (const key of names) delete process.env[key]
    for (const [key, value] of Object.entries(values)) process.env[key] = value
    await run()
  } finally {
    for (const key of names) {
      if (originals[key] === undefined) delete process.env[key]
      else process.env[key] = originals[key]
    }
    globalThis.fetch = originalFetch
  }
}

test('OAuth diagnostic is strictly operator-only, before any provider call', async () => {
  await setup(good, async () => {
    let calls = 0
    globalThis.fetch = (async () => { calls++; throw Error('forbidden') }) as typeof fetch
    for (const bad of [
      new Request('https://vibeschool.co.ke/api/success-wishes/mpesa-readiness'),
      request('anon'),
      request('test-service-role-key-only-extra'),
    ]) {
      const response = await GET(bad)
      assert.equal(response.status, 401)
      assert.equal((await response.json()).stkSent, false)
    }
    assert.equal(calls, 0)
  })
})

test('invalid destination or missing secret rejects without calling Safaricom', async () => {
  for (const bad of [
    { ...good, SUCCESS_WISHES_MPESA_PARTY_B: '961580' },
    { ...good, SUCCESS_WISHES_MPESA_ENV: 'sandbox' },
    { ...good, SUCCESS_WISHES_MPESA_CONSUMER_SECRET: '' },
    { ...good, SUCCESS_WISHES_MPESA_CALLBACK_URL: 'https://evil.example/other' },
  ]) {
    await setup(bad, async () => {
      let calls = 0
      globalThis.fetch = (async () => { calls++; throw Error('forbidden') }) as typeof fetch
      const response = await GET(request())
      const body = await response.json()
      assert.equal(response.status, 503)
      assert.equal(body.oauthVerified, false)
      assert.equal(body.stkSent, false)
      assert.equal(calls, 0)
    })
  }
})

test('successful mocked OAuth only certifies access token, not passkey or settlement', async () => {
  await setup(good, async () => {
    let calls = 0
    globalThis.fetch = (async (url, init) => {
      calls++
      assert.equal(String(url),
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
      const headers = init?.headers as Record<string, string>
      assert.equal(headers.Authorization, 'Basic ' + Buffer.from('consumer:secret').toString('base64'))
      assert.equal(init?.method, 'GET')
      assert.equal(init?.redirect, 'error')
      return Response.json({ access_token: 'opaque-production-oauth-token' })
    }) as typeof fetch
    const response = await GET(request())
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.oauthVerified, true)
    assert.equal(body.passkeyVerified, false)
    assert.equal(body.stkSent, false)
    assert.equal(JSON.stringify(body).includes('opaque-production-oauth-token'), false)
    assert.equal(calls, 1)
  })
})

test('provider rejection is reported without leaking response bodies or credentials', async () => {
  await setup(good, async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      error: 'sensitive-provider-details',
    }), { status: 401, headers: { 'content-type': 'application/json' } })) as typeof fetch
    const response = await GET(request())
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.providerHttpStatus, 401)
    assert.equal(body.oauthVerified, false)
    assert.equal(body.stkSent, false)
    assert.equal(JSON.stringify(body).includes('sensitive-provider-details'), false)
  })
})
