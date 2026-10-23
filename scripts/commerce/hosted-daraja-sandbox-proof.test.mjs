import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_REF, FUNCTION_ORIGIN, validateProofEnvironment,
  classifyProofStatus, runHostedProof,
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
