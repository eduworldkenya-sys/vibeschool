import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentReadinessHandler } from './mpesa-readiness'

const good: Record<string, string> = {
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
const req = new Request('https://vibeschool.co.ke/api/success-wishes/mpesa-readiness')

test('unverified caller cannot inspect configuration or contact Safaricom', async () => {
  let calls=0
  const handle = createPaymentReadinessHandler({
    env: good,
    verifyOperator: async () => false,
    providerFetch: (async () => { calls++; throw Error('forbidden') }) as typeof fetch,
  })
  const response = await handle(req)
  assert.equal(response.status, 403)
  assert.equal((await response.json()).stkSent, false)
  assert.equal(calls, 0)
})

test('wrong destination and absent secrets fail before provider contact', async () => {
  for(const env of [
    {...good, SUCCESS_WISHES_MPESA_PARTY_B: '961580'},
    {...good, SUCCESS_WISHES_MPESA_ENV: 'sandbox'},
    {...good, SUCCESS_WISHES_MPESA_CONSUMER_SECRET: ''},
    {...good, SUCCESS_WISHES_MPESA_CALLBACK_URL: 'https://evil.example/other'},
  ]) {
    let calls = 0
    const handle = createPaymentReadinessHandler({
      env,
      verifyOperator: async () => true,
      providerFetch: (async () => {calls++;throw Error('forbidden')}) as typeof fetch,
    })
    const response = await handle(req)
    const body = await response.json()
    assert.equal(response.status,503)
    assert.equal(body.oauthVerified,false)
    assert.equal(body.stkSent,false)
    assert.equal(calls,0)
  }
})

test('mock production OAuth confirms only token acceptance, never STK or passkey', async () => {
  let calls=0
  const handle = createPaymentReadinessHandler({
    env: good,
    verifyOperator: async () => true,
    providerFetch: (async (url,init) => {
      calls++
      assert.equal(String(url),
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
      assert.equal(init?.method,'GET')
      assert.equal(init?.redirect,'error')
      assert.equal((init?.headers as Record<string,string>).Authorization,
        'Basic '+Buffer.from('consumer:secret').toString('base64'))
      return Response.json({access_token:'opaque-production-oauth-token'})
    }) as typeof fetch,
  })
  const response = await handle(req)
  const body = await response.json()
  assert.equal(response.status,200)
  assert.equal(body.oauthVerified,true)
  assert.equal(body.passkeyVerified,false)
  assert.equal(body.stkSent,false)
  assert.equal(JSON.stringify(body).includes('opaque-production-oauth-token'),false)
  assert.equal(calls,1)
})

test('failed OAuth never leaks provider response or secret', async () => {
  const handle = createPaymentReadinessHandler({
    env: good,
    verifyOperator: async () => true,
    providerFetch: (async () => new Response(
      JSON.stringify({ error:'sensitive-provider-details'}),
      {status:401, headers:{'content-type':'application/json'}},
    )) as typeof fetch,
  })
  const response = await handle(req)
  const body = await response.json()
  assert.equal(response.status,503)
  assert.equal(body.providerHttpStatus,401)
  assert.equal(body.oauthVerified,false)
  assert.equal(JSON.stringify(body).includes('sensitive-provider-details'),false)
})
