import test from 'node:test'
import assert from 'node:assert/strict'
import {makeSandboxOrder,evaluateSandboxCallback,canGrantLiveEntitlement,type SandboxAttempt} from './sandbox'
import {sendUniversalDarajaSandboxStk,type DarajaSandboxSettings} from './daraja-sandbox'
import {
  queryUniversalDarajaSandboxStk,parseDarajaSandboxCallback,
  parseDarajaSandboxQuery,reconcileVerifiedDarajaSandbox,
} from './daraja-reconciliation'

const env={
  VERCEL_ENV:'preview',NODE_ENV:'production',
  COMMERCE_DARAJA_SANDBOX_ENABLED:'true',MPESA_ENV:'sandbox',
}
const settings:DarajaSandboxSettings={
  consumerKey:'synthetic-only-key',consumerSecret:'synthetic-only-secret',
  passkey:'synthetic-passkey',businessShortCode:'174379',partyB:'174379',
  transactionType:'CustomerPayBillOnline',
  callbackUrl:'https://fixture-project.supabase.co/functions/v1/unified-commerce-sandbox-callback?sandbox_token=fixturesandboxtoken12345678901234567890123456789',
  testPhone:'254712345678',
}
const order=(productKind:'teacher_credits'|'learning_product'|'exam_access'|'success_wish'|'school_subscription'|'premium_feature'='success_wish')=>
  makeSandboxOrder({
    orderId:'order_123456789',productKind,itemReference:'verified-item-001',
    trustedPriceKes:50,idempotencyKey:'idempotency_123456789',
    owner:productKind==='success_wish'
      ?{kind:'guest',guestReference:'verified-guest-001'}
      :{kind:'profile',profileId:'verified-profile-001'},
  })
const checkout='ws_CO_221020261522377708374149'
const merchant='727d-4bee-88dd-906bf2f5fdf1293461'
const callback=(code:number,amount=50,phone=254712345678)=>({
  Body:{stkCallback:{
    CheckoutRequestID:checkout,MerchantRequestID:merchant,
    ResultCode:code,ResultDesc:code===0?'Processed':'No response from user',
    ...(code===0?{CallbackMetadata:{Item:[
      {Name:'Amount',Value:amount},
      {Name:'MpesaReceiptNumber',Value:'TESTRECEIPT123'},
      {Name:'PhoneNumber',Value:phone},
    ]}}:{}),
  }},
})
const rawQuery=(code:number|'pending')=>({
  ResponseCode:'0',ResponseDescription:'The service request has been accepted successfully',
  CheckoutRequestID:checkout,MerchantRequestID:merchant,
  ...(code==='pending'?{}:{ResultCode:code,ResultDesc:code===0?'Processed':'No response from user'}),
})
const fakeTransport=(queryResult=rawQuery(0))=>{
  const calls:string[]=[]
  const fetcher=(async(url:RequestInfo|URL)=>{
    const path=String(url)
    calls.push(path)
    const data=path.includes('/oauth/')?{access_token:'synthetic-test-token'}:
      path.includes('/stkpushquery/')?queryResult:{
        ResponseCode:'0',CheckoutRequestID:checkout,MerchantRequestID:merchant,
      }
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})
  }) as typeof fetch
  return {fetcher,calls}
}

test('full synthetic six-product sandbox STK -> query -> callback -> simulated decision',async()=>{
  for(const kind of ['teacher_credits','learning_product','exam_access','success_wish','school_subscription','premium_feature'] as const){
    const f=fakeTransport()
    const attempt=await sendUniversalDarajaSandboxStk({
      env,settings,order:order(kind),phone:'0712345678',fetcher:f.fetcher,
      hasReservedAttempt:async()=>true,
      now:()=>new Date('2026-10-22T11:00:00Z'),
    })
    assert.equal(attempt.state,'awaiting_customer')
    assert.equal(attempt.receipt,null)
    const result=await queryUniversalDarajaSandboxStk({
      attempt,settings,env,fetcher:f.fetcher,
      now:()=>new Date('2026-10-22T11:01:00Z'),
    })
    assert.equal(result.state,'succeeded_unverified')
    assert.equal(reconcileVerifiedDarajaSandbox(attempt,result,null).action,'quarantine')
    const paymentCallback=parseDarajaSandboxCallback(callback(0))
    const decision=reconcileVerifiedDarajaSandbox(attempt,result,paymentCallback)
    assert.equal(decision.action,'settle')
    assert.equal(decision.attempt.receipt,'TESTRECEIPT123')
    assert.equal(canGrantLiveEntitlement(decision.attempt),false)
    assert.equal(evaluateSandboxCallback(decision.attempt,paymentCallback).action,'duplicate')
    assert.equal(f.calls.length,4)
    for(const url of f.calls)assert.ok(url.startsWith('https://sandbox.safaricom.co.ke/'))
  }
})
test('founder observed 1037: query accepted, payment EXPIRED, no simulated entitlement',async()=>{
  const f=fakeTransport(rawQuery(1037))
  const attempt=await sendUniversalDarajaSandboxStk({
    env,settings,order:order(),phone:settings.testPhone,
    fetcher:f.fetcher,hasReservedAttempt:async()=>true,
  })
  const query=await queryUniversalDarajaSandboxStk({attempt,settings,env,fetcher:f.fetcher})
  assert.equal(query.state,'expired')
  assert.equal(query.resultCode,1037)
  const decision=reconcileVerifiedDarajaSandbox(attempt,query,parseDarajaSandboxCallback(callback(1037)))
  assert.equal(decision.action,'fail')
  assert.equal(decision.attempt.state,'expired')
  assert.equal(canGrantLiveEntitlement(decision.attempt),false)
})
test('Daraja 4999 is pending; 1037 callback cannot be incorrectly treated as payment or conflicting final status',()=>{
  const attempt:SandboxAttempt={
    mode:'sandbox',orderId:'order_123456789',checkoutRequestId:checkout,
    merchantRequestId:merchant,phone:'254712345678',expectedAmountKes:50,
    state:'awaiting_customer',receipt:null,
  }
  const pending=parseDarajaSandboxQuery(rawQuery(4999),attempt)
  assert.equal(pending.resultCode,4999)
  assert.equal(pending.state,'pending')
  const pendingDecision=reconcileVerifiedDarajaSandbox(
    attempt,pending,parseDarajaSandboxCallback(callback(1037)))
  assert.equal(pendingDecision.action,'quarantine')
  assert.equal(canGrantLiveEntitlement(pendingDecision.attempt),false)
  const final=parseDarajaSandboxQuery(rawQuery(1037),attempt)
  assert.equal(final.state,'expired')
  assert.equal(reconcileVerifiedDarajaSandbox(
    attempt,final,parseDarajaSandboxCallback(callback(1037))).action,'fail')
})
test('cancelled or rejected STK remains unpaid',()=>{
  const attempt:SandboxAttempt={
    mode:'sandbox',orderId:'order_123456789',checkoutRequestId:checkout,
    merchantRequestId:merchant,phone:'254712345678',expectedAmountKes:50,
    state:'awaiting_customer',receipt:null,
  }
  for(const code of [1032,1037,2001]){
    const query=parseDarajaSandboxQuery(rawQuery(code),attempt)
    const decision=reconcileVerifiedDarajaSandbox(attempt,query,parseDarajaSandboxCallback(callback(code)))
    assert.equal(decision.action,'fail')
    assert.equal(canGrantLiveEntitlement(decision.attempt),false)
  }
})
test('unverified query cannot prove success without callback amount/receipt',()=>{
  const attempt:SandboxAttempt={
    mode:'sandbox',orderId:'order_123456789',checkoutRequestId:checkout,
    merchantRequestId:merchant,phone:'254712345678',expectedAmountKes:50,
    state:'awaiting_customer',receipt:null,
  }
  const verified=parseDarajaSandboxQuery(rawQuery(0),attempt)
  assert.equal(reconcileVerifiedDarajaSandbox(attempt,verified,null).action,'quarantine')
  for(const bad of [
    callback(0,49),
    callback(0,50,254712345679),
    {...callback(0),Body:{stkCallback:{
      ...callback(0).Body.stkCallback,
      MerchantRequestID:'OTHER567890',
    }}},
  ]) {
    const parsed=parseDarajaSandboxCallback(bad)
    assert.equal(reconcileVerifiedDarajaSandbox(attempt,verified,parsed).action,'quarantine')
  }
  assert.equal(reconcileVerifiedDarajaSandbox(
    attempt,verified,parseDarajaSandboxCallback(callback(1037)),
  ).action,'quarantine')
})
test('invalid callback and query fields fail closed',()=>{
  const attempt:SandboxAttempt={
    mode:'sandbox',orderId:'order_123456789',checkoutRequestId:checkout,
    merchantRequestId:merchant,phone:'254712345678',expectedAmountKes:50,
    state:'awaiting_customer',receipt:null,
  }
  assert.throws(()=>parseDarajaSandboxCallback({Body:{stkCallback:{ResultCode:0}}}))
  assert.throws(()=>parseDarajaSandboxCallback({Body:{stkCallback:{
    ...callback(0).Body.stkCallback,
    CallbackMetadata:{Item:[
      {Name:'Amount',Value:50},{Name:'Amount',Value:50},
      {Name:'MpesaReceiptNumber',Value:'TESTRECEIPT123'},
      {Name:'PhoneNumber',Value:254712345678},
    ]},
  }}}),/Duplicate/)
  assert.throws(()=>parseDarajaSandboxQuery({...rawQuery(0),CheckoutRequestID:'OTHER'},attempt))
  assert.throws(()=>parseDarajaSandboxQuery({...rawQuery(0),ResultCode:'NaN'},attempt))
})
test('provider query hard rejects production and invalid auth before network',async()=>{
  let count=0
  const fetcher=(async()=>{count++;throw new Error('must not call')}) as typeof fetch
  const attempt:SandboxAttempt={
    mode:'sandbox',orderId:'order_123456789',checkoutRequestId:checkout,
    merchantRequestId:merchant,phone:'254712345678',expectedAmountKes:50,
    state:'awaiting_customer',receipt:null,
  }
  await assert.rejects(queryUniversalDarajaSandboxStk({
    attempt,settings,env:{...env,MPESA_ENV:'production'},fetcher,
  }))
  await assert.rejects(queryUniversalDarajaSandboxStk({
    attempt,settings,env:{...env,VERCEL_ENV:'production'},fetcher,
  }))
  assert.equal(count,0)
})
