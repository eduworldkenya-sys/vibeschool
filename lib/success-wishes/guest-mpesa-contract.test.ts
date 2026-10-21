import test from 'node:test'
import assert from 'node:assert/strict'
import {createGuestMpesaTransport} from './mpesa-transport'
import {
  guestMpesaSandboxEnabled,serverQuoteWish,parseStkCallback,classifyVerifiedGuestCallback,
} from './guest-mpesa-contract'
import type {Attempt} from './payment-contract'

const env={
  MPESA_ENV:'sandbox',VERCEL_ENV:'preview',SUCCESS_WISHES_ENABLED:'true',
  SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED:'true',
  SUCCESS_WISHES_MPESA_GUEST_CHECKOUT_ENABLED:'true',
  MPESA_CONSUMER_KEY:'sandbox-consumer',MPESA_CONSUMER_SECRET:'sandbox-secret',
  MPESA_SHORTCODE:'174379',MPESA_PASSKEY:'sandbox-passkey',
  SUCCESS_WISHES_MPESA_CALLBACK_URL:'https://sandbox-project.supabase.co/functions/v1/success-wishes-mpesa-callback?secret=test-only',
  SUCCESS_WISHES_PRICE_TEXT_KES:'10',SUCCESS_WISHES_PRICE_VOICE_KES:'20',
  SUCCESS_WISHES_PRICE_VIDEO_KES:'30',
}
const attemptId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const checkout='ws_checkout_123456',merchant='ws_merchant_123456'
function callback(resultCode=0,amount=10,phone=254712345678,receipt='SAMPLE123456'){
  return {Body:{stkCallback:{
    CheckoutRequestID:checkout,MerchantRequestID:merchant,ResultCode:resultCode,
    CallbackMetadata:resultCode===0?{Item:[
      {Name:'Amount',Value:amount},
      {Name:'PhoneNumber',Value:phone},
      {Name:'MpesaReceiptNumber',Value:receipt},
    ]}:undefined,
  }}}
}
const settledAttempt:Attempt={
  state:'awaiting_customer',checkoutRequestId:checkout,merchantRequestId:merchant,
  expectedAmountKes:10,phone:'0712345678',
}

test('sandbox checkout is never enabled outside explicit preview sandbox flags',()=>{
  assert.equal(guestMpesaSandboxEnabled(env),true)
  for(const [key,value] of [
    ['MPESA_ENV','production'],['VERCEL_ENV','production'],
    ['SUCCESS_WISHES_ENABLED','false'],
    ['SUCCESS_WISHES_MPESA_GUEST_CHECKOUT_ENABLED','false'],
    ['SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED','false'],
  ]) assert.equal(guestMpesaSandboxEnabled({...env,[key]:value}),false)
})
test('server quotes KES from private configuration, never sender-controlled price',()=>{
  assert.deepEqual(serverQuoteWish('text',env),{format:'text',amountKes:10,currency:'KES'})
  assert.deepEqual(serverQuoteWish('voice',env),{format:'voice',amountKes:20,currency:'KES'})
  assert.deepEqual(serverQuoteWish('video',env),{format:'video',amountKes:30,currency:'KES'})
  for(const x of ['', '0','-100','0.5','100001','1000000','free'])
    assert.throws(()=>serverQuoteWish('text',{...env,SUCCESS_WISHES_PRICE_TEXT_KES:x}))
  assert.throws(()=>serverQuoteWish('other',env))
})
test('mocked Safaricom OAuth and STK handshake does not grant paid state',async()=>{
  let requests=0
  const transport=createGuestMpesaTransport({
    env,now:()=>new Date('2026-10-21T12:15:00Z'),
    request:async(url,init)=>{
      requests++
      if(String(url).includes('/oauth/')){
        assert.equal((init?.headers as Record<string,string>).Authorization,'Basic '+btoa('sandbox-consumer:sandbox-secret'))
        return Response.json({access_token:'sandbox-oauth-token'})
      }
      assert.equal(String(url),'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
      const req=JSON.parse(String(init?.body))
      assert.equal(req.Amount,10)
      assert.equal(req.PhoneNumber,'254712345678')
      assert.equal(req.CallBackURL,env.SUCCESS_WISHES_MPESA_CALLBACK_URL)
      return Response.json({
        ResponseCode:'0',MerchantRequestID:merchant,CheckoutRequestID:checkout,
        CustomerMessage:'Enter PIN on sandbox phone',
      })
    },
  })
  const acknowledgement=await transport.sendStk({
    id:attemptId,state:'submitting',amountKes:10,phone:'0712345678',
  },async()=>true)
  assert.equal(acknowledgement.state,'awaiting_customer')
  assert.equal(requests,2)
  // Ack never constitutes a settled payment.
  assert.equal(classifyVerifiedGuestCallback({
    attempt:{...settledAttempt,state:'submitting'},
    callback:parseStkCallback(callback()),callbackSecretValid:true,providerQueryConfirmed:true,
  }).decision,'reconciliation_required')
})
test('provider-confirmed, matched callback settles once; duplicates are safe',()=>{
  const parsed=parseStkCallback(callback())
  assert.deepEqual(classifyVerifiedGuestCallback({
    attempt:settledAttempt,callback:parsed,callbackSecretValid:true,providerQueryConfirmed:true,
  }),{decision:'paid',receipt:'SAMPLE123456'})
  assert.deepEqual(classifyVerifiedGuestCallback({
    attempt:{...settledAttempt,state:'settled',providerReceipt:'SAMPLE123456'},
    callback:parsed,callbackSecretValid:true,providerQueryConfirmed:true,
  }),{decision:'duplicate'})
})
test('untrusted, unconfirmed, foreign and inconsistent callbacks never settle',()=>{
  const base=parseStkCallback(callback())
  const samples=[
    {attempt:settledAttempt,callback:base,callbackSecretValid:false,providerQueryConfirmed:true},
    {attempt:settledAttempt,callback:base,callbackSecretValid:true,providerQueryConfirmed:false},
    {attempt:settledAttempt,callback:{...base,checkoutRequestId:'foreign_checkout'},callbackSecretValid:true,providerQueryConfirmed:true},
    {attempt:settledAttempt,callback:{...base,merchantRequestId:'foreign_merchant'},callbackSecretValid:true,providerQueryConfirmed:true},
    {attempt:settledAttempt,callback:parseStkCallback(callback(0,9)),callbackSecretValid:true,providerQueryConfirmed:true},
    {attempt:settledAttempt,callback:parseStkCallback(callback(0,10,254712345679)),callbackSecretValid:true,providerQueryConfirmed:true},
    {attempt:{...settledAttempt,state:'refunded' as const},callback:base,callbackSecretValid:true,providerQueryConfirmed:true},
  ]
  for(const s of samples)assert.equal(classifyVerifiedGuestCallback(s).decision,'reconciliation_required')
})
test('cancellation fails cleanly; malformed or duplicate metadata fail closed',()=>{
  assert.equal(classifyVerifiedGuestCallback({
    attempt:settledAttempt,callback:parseStkCallback(callback(1032)),
    callbackSecretValid:true,providerQueryConfirmed:true,
  }).decision,'failed')
  assert.throws(()=>parseStkCallback({Body:{}}))
  assert.throws(()=>parseStkCallback(callback(0,10,254712345678,'invalid!')))
  const duplicated=callback()
  duplicated.Body.stkCallback.CallbackMetadata!.Item.push({Name:'Amount',Value:10})
  assert.throws(()=>parseStkCallback(duplicated))
  assert.throws(()=>parseStkCallback({Body:{stkCallback:{
    CheckoutRequestID:checkout,MerchantRequestID:merchant,ResultCode:0,
  }}}))
})
