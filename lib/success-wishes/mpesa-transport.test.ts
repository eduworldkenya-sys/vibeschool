import test from 'node:test'
import assert from 'node:assert/strict'
import {createGuestMpesaTransport,guestMpesaTransportReady} from './mpesa-transport'

const id='00000000-0000-4000-8000-000000000001'
const env={
  SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED:'true',
  SUCCESS_WISHES_MPESA_ENV:'sandbox',
  SUCCESS_WISHES_MPESA_CONSUMER_KEY:'consumer',
  SUCCESS_WISHES_MPESA_CONSUMER_SECRET:'secret',
  SUCCESS_WISHES_MPESA_SHORTCODE:'174379',
  SUCCESS_WISHES_MPESA_PARTY_B:'174379',
  SUCCESS_WISHES_MPESA_TRANSACTION_TYPE:'CustomerPayBillOnline',
  SUCCESS_WISHES_MPESA_PASSKEY:'passkey',
  SUCCESS_WISHES_MPESA_CALLBACK_URL:'https://example.supabase.co/functions/v1/success-wishes-mpesa-callback',
}
const attempt={id,phone:'0712345678',amountKes:100,state:'submitting' as const}
const now=()=>new Date('2026-10-21T09:15:00.000Z')

test('M-Pesa guest transport is default off and rejects missing or unsafe configuration',async()=>{
  assert.equal(guestMpesaTransportReady({}),false)
  assert.equal(guestMpesaTransportReady(env),true)
  for(const bad of [
    {...env,SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED:'false'},
    {...env,SUCCESS_WISHES_MPESA_ENV:'productionx'},
    {...env,SUCCESS_WISHES_MPESA_CONSUMER_SECRET:''},
    {...env,SUCCESS_WISHES_MPESA_PARTY_B:'949529'},
    {...env,SUCCESS_WISHES_MPESA_TRANSACTION_TYPE:'CustomerBuyGoodsOnline'},
    {...env,SUCCESS_WISHES_MPESA_CALLBACK_URL:'http://example.supabase.co/functions/v1/success-wishes-mpesa-callback'},
    {...env,SUCCESS_WISHES_MPESA_CALLBACK_URL:'https://evil.example/functions/v1/success-wishes-mpesa-callback'},
    {...env,SUCCESS_WISHES_MPESA_CALLBACK_URL:'https://example.supabase.co/other'},
  ]) {
    assert.equal(guestMpesaTransportReady(bad),false)
    const adapter=createGuestMpesaTransport({env:bad,request:async()=>{throw new Error('should not run')}})
    await assert.rejects(adapter.sendStk(attempt,async()=>true))
  }
})

test('provider is never called unless canonical payment claim and kill switch agree',async()=>{
  let calls=0
  const transport=createGuestMpesaTransport({env,request:async()=>{calls++;throw new Error('provider unexpectedly called')}})
  await assert.rejects(transport.sendStk(attempt,async()=>false),/disabled/)
  assert.equal(calls,0)
  for(const invalid of [
    {...attempt,id:'wrong'},
    {...attempt,state:'created' as const},
    {...attempt,amountKes:0},
    {...attempt,amountKes:1.3},
    {...attempt,phone:'not a phone'},
  ]) await assert.rejects(transport.sendStk(invalid as typeof attempt,async()=>true))
  assert.equal(calls,0)
})

test('sends exact sandbox STK with server-controlled callback and returns awaiting_customer, never paid',async()=>{
  const endpoints:string[]=[]
  const transport=createGuestMpesaTransport({env,now,request:async(url,init)=>{
    endpoints.push(String(url))
    assert.equal(init?.redirect,'error')
    assert.equal(init?.cache,'no-store')
    if(String(url).includes('/oauth/')){
      assert.equal(init?.headers && (init.headers as Record<string,string>).Authorization,
        'Basic '+btoa('consumer:secret'))
      return Response.json({access_token:'oauth-valid-token'})
    }
    assert.equal(init?.method,'POST')
    const body=JSON.parse(String(init?.body))
    assert.equal(body.Amount,100)
    assert.equal(body.BusinessShortCode,'174379')
    assert.equal(body.PartyB,'174379')
    assert.equal(body.TransactionType,'CustomerPayBillOnline')
    assert.equal(body.PartyA,'254712345678')
    assert.equal(body.PhoneNumber,'254712345678')
    assert.equal(body.CallBackURL,env.SUCCESS_WISHES_MPESA_CALLBACK_URL)
    assert.equal(body.AccountReference,'VW0000000000')
    assert.equal(body.TransactionDesc,'Success Wish')
    assert.equal(body.Timestamp,'20261021121500')
    return Response.json({
      ResponseCode:'0',CheckoutRequestID:'checkout_1234',
      MerchantRequestID:'merchant_1234',CustomerMessage:'Check your phone',
    })
  }})
  assert.deepEqual(await transport.sendStk(attempt,async()=>true),{
    state:'awaiting_customer',checkoutRequestId:'checkout_1234',
    merchantRequestId:'merchant_1234',customerMessage:'Check your phone',
  })
  assert.equal(endpoints.length,2)
  assert.equal(endpoints[0],'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
})

test('timeouts, malformed acknowledgments and provider rejection are never treated as paid',async()=>{
  const variants=[
    async()=>{throw new Error('network down')},
    async()=>new Response('down',{status:503}),
    async()=>Response.json({ResponseCode:'0'}),
    async()=>Response.json({ResponseCode:'1',CheckoutRequestID:'checkout_1234',MerchantRequestID:'merchant_1234'}),
  ]
  for(const onStk of variants){
    const transport=createGuestMpesaTransport({env,request:async(url)=>{
      if(String(url).includes('/oauth/'))return Response.json({access_token:'oauth-valid-token'})
      return onStk()
    }})
    await assert.rejects(transport.sendStk(attempt,async()=>true))
  }
})

const productionEnv={
  ...env,
  SUCCESS_WISHES_MPESA_ENV:'production',
  SUCCESS_WISHES_MPESA_CONSUMER_KEY:'production-consumer',
  SUCCESS_WISHES_MPESA_CONSUMER_SECRET:'production-secret',
  SUCCESS_WISHES_MPESA_SHORTCODE:'961580',
  SUCCESS_WISHES_MPESA_PARTY_B:'949529',
  SUCCESS_WISHES_MPESA_TRANSACTION_TYPE:'CustomerBuyGoodsOnline',
  SUCCESS_WISHES_MPESA_PASSKEY:'production-passkey',
  SUCCESS_WISHES_MPESA_CALLBACK_URL:'https://yauqsxggtuxuykcbrtzf.supabase.co/functions/v1/success-wishes-mpesa-callback',
}

test('production Buy Goods STK routes to the approved Till; acknowledgment never counts as paid',async()=>{
  let calls=0
  assert.equal(guestMpesaTransportReady(productionEnv),true)
  const transport=createGuestMpesaTransport({env:productionEnv,now,request:async(url,init)=>{
    calls++
    assert.equal(String(url).startsWith('https://api.safaricom.co.ke/'),true)
    if(String(url).includes('/oauth/')){
      assert.equal((init?.headers as Record<string,string>).Authorization,
        'Basic '+btoa('production-consumer:production-secret'))
      return Response.json({access_token:'oauth-valid-token'})
    }
    const body=JSON.parse(String(init?.body))
    assert.equal(body.BusinessShortCode,'961580')
    assert.equal(body.PartyB,'949529')
    assert.equal(body.TransactionType,'CustomerBuyGoodsOnline')
    assert.equal(body.Amount,100)
    assert.equal(body.CallBackURL,productionEnv.SUCCESS_WISHES_MPESA_CALLBACK_URL)
    return Response.json({
      ResponseCode:'0',CheckoutRequestID:'checkout_1234',
      MerchantRequestID:'merchant_1234',CustomerMessage:'Check your phone',
    })
  }})
  const acknowledgment=await transport.sendStk(attempt,async()=>true)
  assert.equal(acknowledgment.state,'awaiting_customer')
  assert.equal(calls,2)
})

test('production rejects wrong destination, environment crossover and callbacks before contacting Safaricom',async()=>{
  const invalid=[
    {...productionEnv,SUCCESS_WISHES_MPESA_PARTY_B:'961580'},
    {...productionEnv,SUCCESS_WISHES_MPESA_PARTY_B:'174379'},
    {...productionEnv,SUCCESS_WISHES_MPESA_SHORTCODE:'174379'},
    {...productionEnv,SUCCESS_WISHES_MPESA_TRANSACTION_TYPE:'CustomerPayBillOnline'},
    {...productionEnv,SUCCESS_WISHES_MPESA_CALLBACK_URL:env.SUCCESS_WISHES_MPESA_CALLBACK_URL},
    {...productionEnv,SUCCESS_WISHES_MPESA_CALLBACK_URL:productionEnv.SUCCESS_WISHES_MPESA_CALLBACK_URL+'?unexpected=1'},
    {...productionEnv,SUCCESS_WISHES_MPESA_ENV:'sandbox'},
    {...productionEnv,SUCCESS_WISHES_MPESA_CONSUMER_SECRET:''},
  ]
  for(const bad of invalid){
    assert.equal(guestMpesaTransportReady(bad),false)
    let calls=0
    const transport=createGuestMpesaTransport({env:bad,request:async()=>{calls++;throw new Error('must not be called')}})
    await assert.rejects(transport.sendStk(attempt,async()=>true))
    assert.equal(calls,0)
  }
})

test('guest transport cannot inherit unrelated global M-Pesa keys',async()=>{
  const genericOnly={
    SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED:'true',
    MPESA_ENV:'production',MPESA_SHORTCODE:'961580',MPESA_PARTY_B:'949529',
    MPESA_CONSUMER_KEY:'legacy',MPESA_CONSUMER_SECRET:'legacy',MPESA_PASSKEY:'legacy',
    MPESA_TRANSACTION_TYPE:'CustomerBuyGoodsOnline',
    SUCCESS_WISHES_MPESA_CALLBACK_URL:productionEnv.SUCCESS_WISHES_MPESA_CALLBACK_URL,
  }
  assert.equal(guestMpesaTransportReady(genericOnly),false)
})
