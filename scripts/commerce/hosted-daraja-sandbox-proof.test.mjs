import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_REF, FUNCTION_ORIGIN, validateProofEnvironment,
  classifyProofStatus, isPendingReconciliation409,
  checkHostedExistingOrder, runHostedProof,
} from './hosted-daraja-sandbox-proof.mjs'

const token = 'A'.repeat(48)
const env = { COMMERCE_SANDBOX_OPERATOR_TOKEN: token,
  COMMERCE_SANDBOX_TEST_PHONE: '254708374149' }
const orderId='123e4567-e89b-12d3-a456-426614174000'

test('locks hosted payment proof to existing isolated Supabase project', () => {
  assert.equal(PROJECT_REF, 'ufqjgyzspavamdpkdxmc')
  assert.equal(FUNCTION_ORIGIN, `https://${PROJECT_REF}.supabase.co/functions/v1`)
  assert.throws(() => validateProofEnvironment({
    ...env, COMMERCE_SANDBOX_PROJECT_REF:'yauqsxggtuxuykcbrtzf',
  }), /unexpected Supabase project/)
  assert.throws(() => validateProofEnvironment({
    ...env, COMMERCE_SANDBOX_TEST_PHONE:'254700000',
  }), /authorised Daraja simulator/)
  assert.throws(() => validateProofEnvironment({
    ...env, COMMERCE_SANDBOX_OPERATOR_TOKEN:'weak',
  }), /valid COMMERCE_SANDBOX_OPERATOR_TOKEN/)
})

test('only verified sandbox settlement with simulated access counts as passing', () => {
  assert.equal(classifyProofStatus({
    mode:'sandbox', state:'settled_simulated',
    simulated_access:true, real_access:false,
  }), 'passed')
  assert.equal(classifyProofStatus({
    mode:'sandbox', state:'settled_simulated',
    simulated_access:false, real_access:false,
  }), 'invalid')
  assert.equal(classifyProofStatus({
    mode:'sandbox', state:'settled_simulated',
    simulated_access:true, real_access:true,
  }), 'invalid')
  assert.equal(classifyProofStatus({
    mode:'sandbox', state:'created',
    processing_verdict:'expired', simulated_access:false, real_access:false,
  }), 'failed')
  assert.equal(classifyProofStatus({
    mode:'sandbox', state:'awaiting_customer',
    simulated_access:false, real_access:false,
  }), 'waiting')
})

test('proof sends exactly one checkout and only retries status', async () => {
  let checkoutCount=0, statusCount=0
  const logs=[]
  const fetcher=async (url,init) => {
    assert.ok(url.startsWith(FUNCTION_ORIGIN+'/'))
    assert.equal(init.headers.Authorization, 'Bearer '+token)
    assert.equal(init.method, 'POST')
    const data=JSON.parse(init.body)
    if(url.endsWith('/unified-commerce-sandbox-checkout')) {
      checkoutCount++
      assert.equal(data.product_kind,'success_wish')
      assert.equal(data.item_reference,'sandbox-success-wish')
      assert.equal(data.phone,env.COMMERCE_SANDBOX_TEST_PHONE)
      assert.equal(data.amount,undefined)
      return Response.json({
        mode:'sandbox',state:'awaiting_customer',amount_kes:50,
        order_id:orderId,checkout_request_id:'ws_CO_abc123',
      }, {status:202})
    }
    assert.ok(url.endsWith('/unified-commerce-sandbox-status'))
    statusCount++
    assert.equal(data.order_id,orderId)
    return Response.json({
      mode:'sandbox',order_id:orderId,
      state:statusCount===1?'awaiting_customer':'settled_simulated',
      simulated_access:statusCount>1,real_access:false,
    })
  }
  const outcome=await runHostedProof({env,fetcher,pause:async()=>{},
    log:m=>logs.push(m)})
  assert.equal(outcome.verdict,'passed')
  assert.equal(checkoutCount,1)
  assert.equal(statusCount,2)
  assert.match(logs[0],/NOT yet paid/)
  assert.match(logs[1],/SIMULATED/)
})

test('failed sandbox provider payment cannot pass; never issues duplicate STK', async () => {
  let checkoutCount=0
  const fetcher=async(url) => {
    if(url.endsWith('/unified-commerce-sandbox-checkout')) {
      checkoutCount++
      return Response.json({mode:'sandbox',state:'awaiting_customer',
        amount_kes:50,order_id:orderId,checkout_request_id:'ws_CO_abc123'},{status:202})
    }
    return Response.json({mode:'sandbox',order_id:orderId,
      state:'created',processing_verdict:'expired',
      provider_result_code:1037,simulated_access:false,real_access:false})
  }
  await assert.rejects(runHostedProof({env,fetcher,pause:async()=>{},log:()=>{}}),
    /Provider did not complete payment/)
  assert.equal(checkoutCount,1)
})

test('transient sandbox 409 status retries ONLY status until final provider timeout, never STK', async () => {
  let checkoutCount=0, statusCount=0
  const logs=[]
  const fetcher=async(url,init)=>{
    if(url.endsWith('/unified-commerce-sandbox-checkout')) {
      checkoutCount++
      return Response.json({
        mode:'sandbox', state:'awaiting_customer', amount_kes:50,
        order_id:orderId,checkout_request_id:'ws_CO_abc123',
      },{status:202})
    }
    assert.ok(url.endsWith('/unified-commerce-sandbox-status'))
    statusCount++
    assert.equal(JSON.parse(init.body).order_id,orderId)
    if(statusCount===1) return Response.json({
      mode:'sandbox',order_id:orderId,state:'reconciliation_required',
      failure_stage:'provider_query', failure_code:'provider_query_unknown',
      callback_result_code:1037, simulated_access:false,real_access:false,
    },{status:409})
    return Response.json({
      mode:'sandbox',order_id:orderId,state:'created',
      processing_verdict:'expired', provider_result_code:1037,
      simulated_access:false,real_access:false,
    },{status:200})
  }
  await assert.rejects(runHostedProof({env,fetcher,pause:async()=>{},
    log:x=>logs.push(x)}),/Provider did not complete payment: expired/)
  assert.equal(checkoutCount,1)
  assert.equal(statusCount,2)
  assert.match(logs[1],/STATUS only, no new STK/)
})

test('transient 409 eventually settles a simulated order only on verified final status', async () => {
  let checkouts=0, statuses=0
  const fetcher=async(url)=>{
    if(url.endsWith('/unified-commerce-sandbox-checkout')) {
      checkouts++
      return Response.json({mode:'sandbox',state:'awaiting_customer',
        amount_kes:50,order_id:orderId,checkout_request_id:'ws_CO_abc123'
      },{status:202})
    }
    statuses++
    return statuses===1
      ? Response.json({mode:'sandbox',order_id:orderId,
          state:'reconciliation_required',failure_stage:'database_reconciliation',
          simulated_access:false,real_access:false},{status:409})
      : Response.json({mode:'sandbox',order_id:orderId,
          state:'settled_simulated',simulated_access:true,real_access:false})
  }
  const done=await runHostedProof({env,fetcher,pause:async()=>{},log:()=>{}})
  assert.equal(done.verdict,'passed')
  assert.equal(checkouts,1)
  assert.equal(statuses,2)
})

test('409 exception fails closed on wrong order, missing evidence, unsafe access and authorization errors', async () => {
  const pending = {mode:'sandbox', order_id:orderId,state:'reconciliation_required',
    failure_stage:'provider_query',simulated_access:false,real_access:false}
  assert.equal(isPendingReconciliation409(409,pending,orderId),true)
  for (const change of [
    {order_id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'},
    {state:'settled_simulated'}, {mode:'production'},
    {real_access:true}, {simulated_access:true}, {failure_stage:'other'},
    {failure_stage:undefined}, {failure_code:'provider_identity_mismatch'},
    {failure_code:'provider_auth_or_configuration'},
    {failure_code:'provider_response_invalid'},
  ]) assert.equal(isPendingReconciliation409(409,{...pending,...change},orderId),false)
  assert.equal(isPendingReconciliation409(401,pending,orderId),false)
  assert.equal(isPendingReconciliation409(500,pending,orderId),false)

  for (const response of [
    Response.json({error:'Unauthorized'}, {status:401}),
    Response.json({...pending,real_access:true}, {status:409}),
  ]) {
    let checkout=0
    const fetcher=async(url)=>{
      if(url.endsWith('/unified-commerce-sandbox-checkout')) {
        checkout++
        return Response.json({mode:'sandbox',state:'awaiting_customer',
          amount_kes:50,order_id:orderId,checkout_request_id:'ws_CO_abc123'
        },{status:202})
      }
      return response
    }
    await assert.rejects(runHostedProof({env,fetcher,pause:async()=>{},log:()=>{}}),
      /unified-commerce-sandbox-status:/)
    assert.equal(checkout,1)
  }
})

test('persistent transient 409 times out boundedly without retrying checkout', async () => {
  let checkout=0,status=0
  const fetcher=async(url)=>{
    if(url.endsWith('/unified-commerce-sandbox-checkout')) {
      checkout++
      return Response.json({mode:'sandbox',state:'awaiting_customer',
        amount_kes:50,order_id:orderId,checkout_request_id:'ws_CO_abc123'
      },{status:202})
    }
    status++
    return Response.json({mode:'sandbox',order_id:orderId,
      state:'reconciliation_required',failure_stage:'provider_query',
      simulated_access:false,real_access:false},{status:409})
  }
  await assert.rejects(runHostedProof({env,fetcher,pause:async()=>{},log:()=>{}}),
    /needs reconciliation. Do not retry the checkout/)
  assert.equal(checkout,1)
  assert.equal(status,30)
})

test('status-only mode queries the existing order and NEVER calls checkout', async () => {
  let status=0
  const fetcher=async(url,init)=>{
    assert.equal(url,FUNCTION_ORIGIN+'/unified-commerce-sandbox-status')
    assert.equal(init.headers.Authorization,'Bearer '+token)
    assert.deepEqual(JSON.parse(init.body),{order_id:orderId})
    status++
    return Response.json({mode:'sandbox',order_id:orderId,state:'expired',
      provider_result_code:1037,simulated_access:false,real_access:false})
  }
  const result=await checkHostedExistingOrder({env,orderId,fetcher})
  assert.equal(result.verdict,'failed')
  assert.equal(result.status.state,'expired')
  assert.equal(status,1)
  await assert.rejects(checkHostedExistingOrder({env,orderId:'invalid',fetcher}),
    /valid existing sandbox order UUID/)
  assert.equal(status,1)
})

test('status-only mode permits bounded pending reconciliation reply without giving access',async()=>{
  let count=0
  const fetcher=async(url)=>{
    assert.ok(url.endsWith('/unified-commerce-sandbox-status'))
    count++
    return Response.json({mode:'sandbox',order_id:orderId,
      state:'reconciliation_required',failure_stage:'provider_query',
      simulated_access:false,real_access:false},{status:409})
  }
  const result=await checkHostedExistingOrder({env,orderId,fetcher})
  assert.equal(result.verdict,'waiting')
  assert.equal(count,1)
})
