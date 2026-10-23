/**
 * Non-secret defaults are confined to the pre-existing isolated sandbox host.
 * assertDarajaSandboxOnly still checks SUPABASE_URL against the exact
 * project reference and rejects the production VibeSchool Supabase URL.
 * Explicit environment values override these defaults to disable testing.
 */
/**
 * ISOLATED PROJECT ONLY. Do not deploy to the connected VibeSchool production
 * Supabase project. Database schema: qa/commerce/unified-sandbox-*.sql.
 *
 * Safaricom callbacks have no native signature. The opaque callback URL token
 * controls ingress; every successful callback is independently queried on the
 * Daraja SANDBOX API before the database can mint a SIMULATED entitlement.
 *
 * Deployment must use --no-verify-jwt for Daraja callbacks, but must point
 * at a separate sandbox project with both host and database project guards.
 */
import postgres from 'npm:postgres@3.4.5'
import {
  handleDarajaSandboxCallback,type SandboxCallbackStore,
} from '../../../lib/commerce/unified/callback-ingress.ts'
import {
  queryUniversalDarajaSandboxStk,type DarajaSandboxQuery,
} from '../../../lib/commerce/unified/daraja-reconciliation.ts'
import type {SandboxAttempt} from '../../../lib/commerce/unified/sandbox.ts'
import type {DarajaSandboxSettings} from '../../../lib/commerce/unified/daraja-sandbox.ts'

function config() {
  const env={
    COMMERCE_DARAJA_SANDBOX_ENABLED:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_ENABLED') ?? 'true'),
    MPESA_ENV:(Deno.env.get('MPESA_ENV') ?? 'sandbox'),
    SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
    COMMERCE_SANDBOX_PROJECT_REF:(Deno.env.get('COMMERCE_SANDBOX_PROJECT_REF') ?? 'ufqjgyzspavamdpkdxmc'),
    COMMERCE_SANDBOX_ISOLATED_PROJECT:(Deno.env.get('COMMERCE_SANDBOX_ISOLATED_PROJECT') ?? 'true'),
    COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN:Deno.env.get('COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN'),
  }
  const ref=env.COMMERCE_SANDBOX_PROJECT_REF||''
  const databaseUrl=Deno.env.get('COMMERCE_SANDBOX_DATABASE_URL')||''
  let database:URL
  try {database=new URL(databaseUrl)} catch {throw new Error('Sandbox database URL is not configured')}
  const direct=database.hostname==='db.'+ref+'.supabase.co'
  const pooler=database.hostname.endsWith('.pooler.supabase.com')
    && database.username==='postgres.'+ref
  if(database.protocol!=='postgresql:'&&database.protocol!=='postgres:'
    ||(!direct&&!pooler)||!!database.hash||!!database.search
    || !database.password)throw new Error('Refusing database connection outside isolated Supabase project')
  const required=(key:string)=>{
    const value=Deno.env.get(key)||''
    if(!value)throw new Error('Missing sandbox provider configuration: '+key)
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
  return {env,databaseUrl,settings}
}

Deno.serve(async(req)=>{
  let c:ReturnType<typeof config>
  try{c=config()}catch{return new Response('Sandbox unavailable',{status:503})}
  const db=postgres(c.databaseUrl,{max:1,prepare:false,idle_timeout:5,connect_timeout:5})
  try{
    const store:SandboxCallbackStore={
      async persistCallback({key,callback}){
        await db`insert into commerce_sandbox.provider_inbox (
          checkout_request_id,merchant_request_id,provider_event_key,
          result_code,paid_amount_kes,phone,provider_receipt
        ) values (
          ${callback.checkoutRequestId},${callback.merchantRequestId},${key},
          ${callback.resultCode},${callback.amountKes ?? null},${callback.phone ?? null},${callback.receipt ?? null}
        ) on conflict(provider_event_key) do nothing`
      },
      async findAttempt(checkoutRequestId){
        const rows=await db`select order_id,checkout_request_id,merchant_request_id,
          amount_kes,phone,state,provider_receipt from commerce_sandbox.payment_attempts
          where checkout_request_id=${checkoutRequestId} limit 1`
        if(!rows.length)return null
        const a=rows[0]
        return {
          mode:'sandbox',orderId:String(a.order_id),
          checkoutRequestId:String(a.checkout_request_id),
          merchantRequestId:String(a.merchant_request_id),
          expectedAmountKes:Number(a.amount_kes),
          phone:String(a.phone),receipt:a.provider_receipt?String(a.provider_receipt):null,
          state:a.state==='settled_simulated'?'settled':String(a.state),
        } as SandboxAttempt
      },
      async persistQuery(q:DarajaSandboxQuery){
        await db`insert into commerce_sandbox.provider_query_observations (
          checkout_request_id,merchant_request_id,result_code
        ) values (${q.checkoutRequestId},${q.merchantRequestId},${q.resultCode})
        on conflict do nothing`
      },
      async reconcile(checkoutRequestId){
        const result=await db`select commerce_sandbox.reconcile_sandbox(${checkoutRequestId}) as state`
        return String(result[0]?.state||'reconciliation_required')
      },
    }
    return await handleDarajaSandboxCallback(req,{
      env:c.env,store,
      queryProvider:attempt=>queryUniversalDarajaSandboxStk({
        attempt,settings:c.settings,env:c.env,
      }),
    })
  }finally{await db.end({timeout:2}).catch(()=>undefined)}
})
