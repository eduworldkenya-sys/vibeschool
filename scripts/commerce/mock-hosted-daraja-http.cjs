'use strict'
// Only loaded by scripts/test-success-wishes-hosted-http.mjs in an isolated
// Next dev child process. Intercepts exclusively the pinned Daraja sandbox
// Edge Function URLs. No provider, external payment, or DB traffic.
if (process.env.VSW_HOSTED_HTTP_MOCK !== 'yes') {
  throw new Error('Refusing hosted HTTP test mock outside explicit CI fixture')
}
const original = globalThis.fetch
let started = 0
globalThis.fetch = async function sandboxMock(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
  const origin = 'https://ufqjgyzspavamdpkdxmc.supabase.co/functions/v1/'
  if (typeof url !== 'string' || !url.startsWith(origin)) return original(input, init)
  const endpoint = url.slice(origin.length)
  if (!['unified-commerce-sandbox-checkout','unified-commerce-sandbox-status'].includes(endpoint)) {
    return new Response(JSON.stringify({error:'unexpected sandbox endpoint'}),{status:500})
  }
  const payload = JSON.parse(init?.body || '{}')
  if (init?.headers?.Authorization !== 'Bearer ' + 'A'.repeat(48))
    return new Response(JSON.stringify({error:'invalid test operator token'}),{status:401})
  if (endpoint === 'unified-commerce-sandbox-checkout') {
    started++
    if (started > 1) return new Response(JSON.stringify({error:'STK was sent more than once'}),{status:409})
    if (payload.phone !== '254708374149' || payload.item_reference !== 'sandbox-success-wish' ||
        payload.product_kind !== 'success_wish' || payload.amount_kes !== undefined)
      return new Response(JSON.stringify({error:'wrong sandbox item or phone'}),{status:400})
    return new Response(JSON.stringify({
      mode:'sandbox',
      order_id:'123e4567-e89b-42d3-a456-426614174000',
      checkout_request_id:'ws_CO_231020261415502708374149',
      state:'awaiting_customer', amount_kes:50
    }),{status:202,headers:{'Content-Type':'application/json'}})
  }
  if (payload.order_id !== '123e4567-e89b-42d3-a456-426614174000') {
    return new Response(JSON.stringify({error:'wrong order'}),{status:404})
  }
  return new Response(JSON.stringify({
    mode:'sandbox',order_id:payload.order_id,
    state:'settled_simulated',simulated_access:true,real_access:false,
    provider_result_code:0
  }),{status:200,headers:{'Content-Type':'application/json'}})
}
