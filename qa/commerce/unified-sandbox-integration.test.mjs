// True cross-component synthetic test: Node HTTP transport + disposable PostgreSQL.
// No real Safaricom calls. No live VibeSchool Supabase tables or entitlements.
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {
  makeSandboxOrder,canGrantLiveEntitlement,
} from '../../lib/commerce/unified/sandbox.ts'
import {
  sendUniversalDarajaSandboxStk,
} from '../../lib/commerce/unified/daraja-sandbox.ts'
import {
  queryUniversalDarajaSandboxStk,parseDarajaSandboxCallback,
  reconcileVerifiedDarajaSandbox,
} from '../../lib/commerce/unified/daraja-reconciliation.ts'

function sql(command) {
  const text=execFileSync('psql',['-v','ON_ERROR_STOP=1','-X','-At','-c',command],{
    env:{...process.env,PGPASSWORD:'disposable-fixture-only'},
    encoding:'utf8',
  }).trim()
  return text.split('\n').at(-1)
}
const env={
  MPESA_ENV:'sandbox',
  COMMERCE_DARAJA_SANDBOX_ENABLED:'true',
  VERCEL_ENV:'preview',
  NODE_ENV:'production',
}
const settings={
  consumerKey:'fake-simulator-key',consumerSecret:'fake-simulator-secret',
  passkey:'fake-simulator-passkey',businessShortCode:'174379',
  partyB:'174379',transactionType:'CustomerPayBillOnline',
  callbackUrl:'https://isolated-fake.supabase.co/functions/v1/unified-commerce-sandbox-callback?sandbox_token=fixturesandboxtoken12345678901234567890123456789',
  testPhone:'254712345678',
  stkRecipientPhone:'254700111222',
}
const checkout='ws_CO_SYNTHETIC_HTTP_123'
const merchant='merchant_SYNTHETIC_HTTP_123'
const receipt='SIMULATEDHTTPE2E1'
const fetchCalls=[]
const fetcher=async(url,init)=>{
  const path=String(url)
  assert.ok(path.startsWith('https://sandbox.safaricom.co.ke/'))
  fetchCalls.push({url:path,body:init?.body ? JSON.parse(String(init.body)) : null})
  const value=path.includes('/oauth/')
    ? {access_token:'fixture-token-not-a-real-token'}
    : path.includes('/stkpushquery/')
      ? {ResponseCode:'0',CheckoutRequestID:checkout,MerchantRequestID:merchant,
        ResultCode:0,ResultDesc:'The service request is processed successfully.'}
      : {ResponseCode:'0',CheckoutRequestID:checkout,MerchantRequestID:merchant}
  return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
}

test('synthetic guest checkout persists one paid-simulated wish and no real entitlement',async()=>{
  const key='integration-'+randomUUID().replace(/-/g,'')
  const owner='guest-integration-123456'
  const orderId=sql(`select commerce_sandbox.create_trusted_order(
    'success_wish','sandbox-success-wish','guest','${owner}','${key}');`)
  assert.match(orderId,/^[0-9a-f-]{36}$/)
  const again=sql(`select commerce_sandbox.create_trusted_order(
    'success_wish','sandbox-success-wish','guest','${owner}','${key}');`)
  assert.equal(orderId,again)
  assert.equal(sql(`select amount_kes from commerce_sandbox.orders where id='${orderId}'`),'50')
  const attemptId=sql(`select commerce_sandbox.reserve_attempt(
    '${orderId}','254700111222');`)
  assert.equal(attemptId,sql(`select commerce_sandbox.reserve_attempt(
    '${orderId}','254712345678');`))

  const order=makeSandboxOrder({
    orderId:'order_'+orderId.replaceAll('-',''),
    productKind:'success_wish',itemReference:'sandbox-success-wish',
    trustedPriceKes:50,
    owner:{kind:'guest',guestReference:owner},
    idempotencyKey:key,
  })
  const result=await sendUniversalDarajaSandboxStk({
    order,phone:'0700111222',settings,env,fetcher,
    hasReservedAttempt:async()=>sql(`select commerce_sandbox.claim_stk_send('${attemptId}');`)==='t',
    now:()=>new Date('2026-10-22T11:00:00Z'),
  })
  assert.equal(sql(`select commerce_sandbox.claim_stk_send('${attemptId}');`),'f')
  assert.equal(result.state,'awaiting_customer')
  assert.equal(result.receipt,null)
  assert.equal(result.phone,'254700111222')
  const stkBody=fetchCalls.find(call=>call.url.includes('/stkpush/v1/processrequest'))?.body
  assert.equal(stkBody?.PartyA,'254712345678')
  assert.equal(stkBody?.PhoneNumber,'254700111222')
  assert.equal(stkBody?.Amount,50)

  // The callback may be received before STK provider IDs have been attached.
  const payload={Body:{stkCallback:{
    CheckoutRequestID:checkout,MerchantRequestID:merchant,ResultCode:0,
    ResultDesc:'Completed',CallbackMetadata:{Item:[
      {Name:'Amount',Value:50},{Name:'MpesaReceiptNumber',Value:receipt},
      {Name:'PhoneNumber',Value:254700111222},
    ]},
  }}}
  const cb=parseDarajaSandboxCallback(payload)
  assert.equal(cb.amountKes,50)
  sql(`insert into commerce_sandbox.provider_inbox(
    checkout_request_id,merchant_request_id,provider_event_key,
    result_code,paid_amount_kes,phone,provider_receipt
  ) values('${cb.checkoutRequestId}','${cb.merchantRequestId}',
    'http-e2e-callback-001',0,50,'${cb.phone}','${cb.receipt}');`)
  assert.equal(sql(`select commerce_sandbox.reconcile_sandbox('${checkout}')`),
    'early_event_waiting_for_attachment')
  assert.equal(sql('select count(*) from commerce_sandbox.simulated_entitlements'),'0')
  assert.equal(sql(`select commerce_sandbox.attach_stk(
    '${attemptId}','${checkout}','${merchant}');`),'t')
  assert.equal(sql(`select commerce_sandbox.reconcile_sandbox('${checkout}')`),'query_pending')

  const query=await queryUniversalDarajaSandboxStk({
    attempt:result,settings,env,fetcher,
    now:()=>new Date('2026-10-22T11:01:00Z'),
  })
  assert.equal(query.state,'succeeded_unverified')
  assert.equal(reconcileVerifiedDarajaSandbox(result,query,null).action,'quarantine')
  const verified=reconcileVerifiedDarajaSandbox(result,query,cb)
  assert.equal(verified.action,'settle')
  assert.equal(canGrantLiveEntitlement(verified.attempt),false)
  sql(`insert into commerce_sandbox.provider_query_observations(
    checkout_request_id,merchant_request_id,result_code
  ) values('${query.checkoutRequestId}','${query.merchantRequestId}',${query.resultCode});`)
  assert.equal(sql(`select commerce_sandbox.reconcile_sandbox('${checkout}')`),'settled_simulated')
  assert.equal(sql(`select commerce_sandbox.reconcile_sandbox('${checkout}')`),'duplicate_settlement')
  assert.equal(sql(`select count(*) from commerce_sandbox.simulated_entitlements
    where order_id='${orderId}'`),'1')
  assert.equal(sql(`select count(*) from commerce_sandbox.simulated_entitlements`),'1')
  assert.equal(sql(`select mode from commerce_sandbox.simulated_entitlements
    where order_id='${orderId}'`),'sandbox')
  assert.equal(fetchCalls.length,4)
})
