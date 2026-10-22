import test from 'node:test'
import assert from 'node:assert/strict'
import {handleDarajaSandboxCallback,type SandboxCallbackStore} from './callback-ingress'
import type {SandboxAttempt} from './sandbox'

const url='https://isolatedref12345.supabase.co/functions/v1/unified-commerce-sandbox-callback'
const token='synthetic-webhook-unguessable-token-'+'a'.repeat(40)
const env={
  VERCEL_ENV:'preview',NODE_ENV:'production',MPESA_ENV:'sandbox',
  COMMERCE_DARAJA_SANDBOX_ENABLED:'true',
  COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN:token,
}
const checkout='ws_CO_SYNTHETIC_HTTP_123'
const merchant='merchant_SYNTHETIC_HTTP_123'
const attempt:SandboxAttempt={
  mode:'sandbox',orderId:'order_synthetic123',checkoutRequestId:checkout,
  merchantRequestId:merchant,expectedAmountKes:50,
  phone:'254712345678',state:'awaiting_customer',receipt:null,
}
const callback=()=>({
  Body:{stkCallback:{
    CheckoutRequestID:checkout,MerchantRequestID:merchant,
    ResultCode:0,ResultDesc:'Processed',
    CallbackMetadata:{Item:[
      {Name:'Amount',Value:50},
      {Name:'MpesaReceiptNumber',Value:'SYNTHETIC12345'},
      {Name:'PhoneNumber',Value:254712345678},
    ]},
  }},
})
const request=(payload:unknown, urlToken=token)=>new Request(url+'?sandbox_token='+urlToken,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload),
})
const makeStore=(existing:SandboxAttempt|null=attempt)=>{
  const events=new Map<string,unknown>()
  const queries:unknown[]=[]
  let reconciles=0
  const store:SandboxCallbackStore={
    persistCallback:async event=>{events.set(event.key,event.callback)},
    findAttempt:async()=>existing,
    persistQuery:async query=>{queries.push(query)},
    reconcile:async()=>{reconciles++;return 'settled_simulated'},
  }
  return {store,events,queries,get reconciles(){return reconciles}}
}
const goodQuery={
  checkoutRequestId:checkout,merchantRequestId:merchant,
  resultCode:0,resultDescription:'Processed',state:'succeeded_unverified' as const,
}
test('authenticated synthetic callback persists before status query and reconciliation',async()=>{
  const x=makeStore()
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env,store:x.store,queryProvider:async()=>goodQuery,
  })
  assert.equal(res.status,200)
  assert.equal(x.events.size,1)
  assert.equal(x.queries.length,1)
  assert.equal(x.reconciles,1)
  // An immutable event key stays the same across redeliveries.
  await handleDarajaSandboxCallback(request(callback()),{
    env,store:x.store,queryProvider:async()=>goodQuery,
  })
  assert.equal(x.events.size,1)
})
test('rejects missing/wrong token without saving callback or making provider query',async()=>{
  const x=makeStore()
  let queried=0
  for(const wrong of ['', 'wrong-token']){
    const res=await handleDarajaSandboxCallback(request(callback(),wrong),{
      env,store:x.store,queryProvider:async()=>{queried++;return goodQuery},
    })
    assert.equal(res.status,401)
  }
  assert.equal(x.events.size,0)
  assert.equal(queried,0)
})
test('persisted callback with no attached attempt is buffered, never settled',async()=>{
  const x=makeStore(null)
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env,store:x.store,queryProvider:async()=>{throw new Error('should not query')},
  })
  assert.equal(res.status,200)
  assert.equal(x.events.size,1)
  assert.equal(x.reconciles,0)
})
test('failed callback persistence returns retryable HTTP error',async()=>{
  const x=makeStore()
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env,store:{...x.store,persistCallback:async()=>{throw new Error('database unavailable')}},
    queryProvider:async()=>goodQuery,
  })
  assert.equal(res.status,503)
  assert.equal(x.reconciles,0)
})
test('Daraja query unavailable after persisted callback causes no settlement',async()=>{
  const x=makeStore()
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env,store:x.store,queryProvider:async()=>{throw new Error('timeout')},
  })
  assert.equal(res.status,200)
  assert.equal(x.events.size,1)
  assert.equal(x.reconciles,0)
})
test('query/callback disagreement quarantines rather than settling',async()=>{
  const x=makeStore()
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env,store:x.store,
    queryProvider:async()=>({...goodQuery,resultCode:1037,state:'expired'}),
  })
  assert.equal(res.status,200)
  assert.equal(x.reconciles,0)
})
test('known production Supabase project is rejected regardless of flags',async()=>{
  const x=makeStore()
  const res=await handleDarajaSandboxCallback(request(callback()),{
    env:{...env,SUPABASE_URL:'https://yauqsxggtuxuykcbrtzf.supabase.co',
      COMMERCE_SANDBOX_PROJECT_REF:'yauqsxggtuxuykcbrtzf',
      COMMERCE_SANDBOX_ISOLATED_PROJECT:'true'},
    store:x.store,queryProvider:async()=>goodQuery,
  })
  assert.equal(res.status,503)
  assert.equal(x.events.size,0)
})
