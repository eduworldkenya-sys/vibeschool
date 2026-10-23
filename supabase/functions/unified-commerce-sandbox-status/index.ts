/**
 * Non-secret defaults are confined to the pre-existing isolated sandbox host.
 * assertDarajaSandboxOnly still checks SUPABASE_URL against the exact
 * project reference and rejects the production VibeSchool Supabase URL.
 * Explicit environment values override these defaults to disable testing.
 */
/**
 * Isolated, OPERATOR-ONLY sandbox payment status endpoint. Do not expose to
 * customers or deploy to primary VibeSchool Supabase. No real entitlements.
 */
import postgres from 'npm:postgres@3.4.5'
import {
  assertDarajaSandboxOnly,type SandboxAttempt,
} from '../../../lib/commerce/unified/sandbox.ts'
import {queryUniversalDarajaSandboxStk} from '../../../lib/commerce/unified/daraja-reconciliation.ts'
import type {DarajaSandboxSettings} from '../../../lib/commerce/unified/daraja-sandbox.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
})
async function equalSecret(a:string,b:string){
  if(a.length<32||b.length<32||a.length>256||b.length>256)return false
  const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(s)))
  const x=await digest(a),y=await digest(b);let diff=0
  for(let i=0;i<x.length;i++)diff|=x[i]^y[i]
  return diff===0
}
Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const env={
    MPESA_ENV:(Deno.env.get('MPESA_ENV') ?? 'sandbox'),
    COMMERCE_DARAJA_SANDBOX_ENABLED:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_ENABLED') ?? 'true'),
    COMMERCE_SANDBOX_ISOLATED_PROJECT:(Deno.env.get('COMMERCE_SANDBOX_ISOLATED_PROJECT') ?? 'true'),
    COMMERCE_SANDBOX_PROJECT_REF:(Deno.env.get('COMMERCE_SANDBOX_PROJECT_REF') ?? 'ufqjgyzspavamdpkdxmc'),
    SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
  }
  try{assertDarajaSandboxOnly(env)}catch{return json({error:'Sandbox disabled'},503)}
  const authorization=req.headers.get('authorization')||''
  const secret=Deno.env.get('COMMERCE_SANDBOX_OPERATOR_TOKEN')||''
  if(!authorization.startsWith('Bearer ')||!await equalSecret(authorization.slice(7),secret))
    return json({error:'Unauthorized'},401)
  if(Number(req.headers.get('content-length')||0)>1024)return json({error:'Too large'},413)
  let orderId:string
  try{
    const raw=await req.text()
    if(raw.length>1024)throw Error('Too large')
    const body=JSON.parse(raw)
    orderId=body?.order_id
    if(typeof orderId!=='string'||!/^[0-9a-f-]{36}$/i.test(orderId))
      throw Error('Invalid order')
  }catch{return json({error:'Invalid order id'},400)}
  const ref=env.COMMERCE_SANDBOX_PROJECT_REF||''
  const databaseUrl=Deno.env.get('COMMERCE_SANDBOX_DATABASE_URL')||''
  let parsed:URL
  try{parsed=new URL(databaseUrl)}
  catch{return json({error:'Sandbox database not configured'},503)}
  const allowedHost=parsed.hostname==='db.'+ref+'.supabase.co'
    ||parsed.hostname.endsWith('.pooler.supabase.com')&&parsed.username==='postgres.'+ref
  if(!allowedHost||!['postgres:','postgresql:'].includes(parsed.protocol)
    ||!parsed.password||parsed.hash||parsed.search)
    return json({error:'Refusing non-isolated database'},503)
  const db=postgres(databaseUrl,{max:1,prepare:false,idle_timeout:5,connect_timeout:5})
  try{
    const rows=await db`select o.id as order_id,o.state as order_state,
      a.checkout_request_id,a.merchant_request_id,a.amount_kes,a.phone,
      a.state as attempt_state,a.provider_receipt
      from commerce_sandbox.orders o
      left join lateral (
        select * from commerce_sandbox.payment_attempts
        where order_id=o.id order by created_at desc limit 1
      ) a on true
      where o.id=${orderId}::uuid`
    if(!rows.length)return json({error:'Unknown sandbox order'},404)
    const a=rows[0]
    if(a.order_state==='settled_simulated'){
      const access=await db`select count(*)::integer as n
        from commerce_sandbox.simulated_entitlements where order_id=${orderId}::uuid`
      return json({mode:'sandbox',order_id:orderId,state:'settled_simulated',
        simulated_access:access[0]?.n===1,real_access:false})
    }
    if(!a.checkout_request_id||!a.merchant_request_id
      ||!['awaiting_customer','reconciliation_required'].includes(a.attempt_state))
      return json({mode:'sandbox',order_id:orderId,state:a.attempt_state||a.order_state,
        simulated_access:false,real_access:false})
    const required=(name:string)=>{
      const value=Deno.env.get(name)
      if(!value)throw new Error('Sandbox provider not configured')
      return value
    }
    const settings:DarajaSandboxSettings={
      consumerKey:required('COMMERCE_DARAJA_SANDBOX_CONSUMER_KEY'),
      consumerSecret:required('COMMERCE_DARAJA_SANDBOX_CONSUMER_SECRET'),
      passkey:required('COMMERCE_DARAJA_SANDBOX_PASSKEY'),
      businessShortCode:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_SHORTCODE')?.trim() || '174379'),
      partyB:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_PARTY_B')?.trim() || '174379'),
      transactionType:'CustomerPayBillOnline',
      callbackUrl:required('COMMERCE_DARAJA_SANDBOX_CALLBACK_URL'),
      testPhone:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_TEST_PHONE')?.trim() || '254708374149'),
    }
    const attempt:SandboxAttempt={
      mode:'sandbox',orderId,checkoutRequestId:String(a.checkout_request_id),
      merchantRequestId:String(a.merchant_request_id),
      expectedAmountKes:Number(a.amount_kes),
      phone:String(a.phone),state:a.attempt_state,receipt:a.provider_receipt,
    }
    const provider=await queryUniversalDarajaSandboxStk({attempt,settings,env})
    await db`insert into commerce_sandbox.provider_query_observations(
      checkout_request_id,merchant_request_id,result_code
    ) values(${provider.checkoutRequestId},${provider.merchantRequestId},
      ${provider.resultCode}) on conflict do nothing`
    const verdict=await db`select commerce_sandbox.reconcile_sandbox(
      ${attempt.checkoutRequestId}) as state`
    const stored=await db`select state from commerce_sandbox.orders
      where id=${orderId}::uuid`
    const realAccess=false
    const simulated=stored[0]?.state==='settled_simulated'
    return json({mode:'sandbox',order_id:orderId,
      state:stored[0]?.state||'reconciliation_required',
      processing_verdict:verdict[0]?.state,
      provider_result_code:provider.resultCode,
      simulated_access:simulated,real_access:realAccess})
  }catch{
    return json({mode:'sandbox',order_id:orderId,state:'reconciliation_required',
      simulated_access:false,real_access:false,
      message:'Provider outcome uncertain; original STK request was not retried'},409)
  }finally{await db.end({timeout:2}).catch(()=>undefined)}
})
