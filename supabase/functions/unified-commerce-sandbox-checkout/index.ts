/**
 * Non-secret defaults are confined to the pre-existing isolated sandbox host.
 * assertDarajaSandboxOnly still checks SUPABASE_URL against the exact
 * project reference and rejects the production VibeSchool Supabase URL.
 * Explicit environment values override these defaults to disable testing.
 */
/**
 * Isolated, OPERATOR-ONLY checkout commissioning endpoint. Not a public
 * customer checkout or payment release. Never deploy to primary Supabase.
 * Reuses the private disposable-schema contracts from qa/commerce.
 */
import postgres from 'npm:postgres@3.4.5'
import {validateIsolatedSandboxDatabaseUrl} from '../../../lib/commerce/unified/sandbox-db.ts'
import {
  assertDarajaSandboxOnly,makeSandboxOrder,normalizeKenyanPhone,
  type ProductKind,
} from '../../../lib/commerce/unified/sandbox.ts'
import {
  sendUniversalDarajaSandboxStk,type DarajaSandboxSettings,
} from '../../../lib/commerce/unified/daraja-sandbox.ts'

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  })
}
async function tokenEqual(a:string,b:string):Promise<boolean>{
  if(!a||!b||a.length>256||b.length<32||b.length>256)return false
  const values=await Promise.all([a,b].map(x=>crypto.subtle.digest(
    'SHA-256',new TextEncoder().encode(x))))
  const left=new Uint8Array(values[0]),right=new Uint8Array(values[1])
  let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i]
  return diff===0
}
const PRODUCTS=new Set([
  'teacher_credits','learning_product','exam_access',
  'success_wish','school_subscription','premium_feature',
])
/** Produce only a sandbox callback URL for the exact isolated project. */
function sandboxCallbackUrl(projectUrl: string): string {
  const configured=Deno.env.get('COMMERCE_DARAJA_SANDBOX_CALLBACK_URL')?.trim()
  if(configured)return configured
  const token=Deno.env.get('COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN')?.trim()||''
  if(!/^[A-Za-z0-9_-]{32,200}$/.test(token))throw new Error('Sandbox webhook token not configured')
  return projectUrl+'/functions/v1/unified-commerce-sandbox-callback?sandbox_token='+token
}

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const env={
    COMMERCE_DARAJA_SANDBOX_ENABLED:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_ENABLED') ?? 'true'),
    MPESA_ENV:(Deno.env.get('MPESA_ENV') ?? 'sandbox'),
    SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
    COMMERCE_SANDBOX_PROJECT_REF:(Deno.env.get('COMMERCE_SANDBOX_PROJECT_REF') ?? 'ufqjgyzspavamdpkdxmc'),
    COMMERCE_SANDBOX_ISOLATED_PROJECT:(Deno.env.get('COMMERCE_SANDBOX_ISOLATED_PROJECT') ?? 'true'),
  }
  try{assertDarajaSandboxOnly(env)}
  catch{return json({error:'Sandbox disabled'},503)}
  const authorization=req.headers.get('authorization')||''
  const operatorToken=Deno.env.get('COMMERCE_SANDBOX_OPERATOR_TOKEN')||''
  if(!authorization.startsWith('Bearer ')||
    !await tokenEqual(authorization.slice(7),operatorToken))return json({error:'Unauthorized'},401)

  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')
    return json({error:'Expected JSON'},415)
  if(Number(req.headers.get('content-length')||0)>8000)return json({error:'Too large'},413)
  let body:Record<string,unknown>
  try{
    const raw=await req.text()
    if(raw.length>8000)throw new Error('Too large')
    body=JSON.parse(raw)
    if(!body||Array.isArray(body)||typeof body!=='object')throw new Error('Expected object')
  }catch{return json({error:'Invalid checkout request'},400)}
  const kind=body.product_kind
  const ref=body.item_reference,ownerType=body.owner_type,ownerReference=body.owner_reference
  const key=body.idempotency_key,requestedPhone=body.phone
  if(typeof kind!=='string'||!PRODUCTS.has(kind)
    ||typeof ref!=='string'||!(/^[a-zA-Z0-9][a-zA-Z0-9_:-]{5,100}$/).test(ref)
    ||(ownerType!=='profile'&&ownerType!=='guest')
    ||typeof ownerReference!=='string'
    ||!(/^[a-zA-Z0-9][a-zA-Z0-9_:-]{5,100}$/).test(ownerReference)
    ||typeof key!=='string'||!(/^[A-Za-z0-9_-]{16,80}$/).test(key)
    ||typeof requestedPhone!=='string')return json({error:'Invalid checkout identifiers'},400)
  let phone:string
  try{phone=normalizeKenyanPhone(requestedPhone)}
  catch{return json({error:'Invalid test phone'},400)}
  const projectRef=env.COMMERCE_SANDBOX_PROJECT_REF||''
  const databaseUrl=(Deno.env.get('COMMERCE_SANDBOX_DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '')
  const databaseGuard=validateIsolatedSandboxDatabaseUrl(databaseUrl,projectRef)
  if(!databaseGuard.ok)
    return json({error:'Refusing non-isolated database',reason:databaseGuard.reason},503)
  const setting=(name:string)=>{
    const value=Deno.env.get(name)?.trim()
    if(!value)throw new Error('Sandbox configuration incomplete')
    return value
  }
  let settings:DarajaSandboxSettings
  try{
    settings={
      consumerKey:setting('COMMERCE_DARAJA_SANDBOX_CONSUMER_KEY'),
      consumerSecret:setting('COMMERCE_DARAJA_SANDBOX_CONSUMER_SECRET'),
      passkey:setting('COMMERCE_DARAJA_SANDBOX_PASSKEY'),
      businessShortCode:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_SHORTCODE')?.trim() || '174379'),
      partyB:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_PARTY_B')?.trim() || '174379'),
      transactionType:'CustomerPayBillOnline',
      callbackUrl:sandboxCallbackUrl(env.SUPABASE_URL || ''),
      testPhone:(Deno.env.get('COMMERCE_DARAJA_SANDBOX_TEST_PHONE')?.trim() || '254708374149'),
    }
  }catch{return json({error:'Sandbox provider not configured'},503)}
  const db=postgres(databaseGuard.connectionString,{max:1,prepare:false,ssl:'require',idle_timeout:5,connect_timeout:5})
  let attemptId:string|null=null
  try{
    // The database's private active catalogue decides which product can be
    // sold and for what price. Reject unknown references before creating
    // any order or reserving/sending any STK. Never trust a caller price.
    const products=await db`select trusted_price_kes
      from commerce_sandbox.catalogue
      where product_kind=${kind} and item_reference=${ref} and active=true
      limit 1`
    if(products.length!==1)return json({
      error:'Unknown or inactive sandbox catalogue item',
      code:'invalid_catalogue_item',
    },400)
    const rows=await db`select commerce_sandbox.create_trusted_order(
      ${kind},${ref},${ownerType},${ownerReference},${key}) as id`
    const orderId=String(rows[0]?.id||'')
    const orderRows=await db`select product_kind,item_reference,amount_kes,state
      from commerce_sandbox.orders where id=${orderId}::uuid`
    const stored=orderRows[0]
    if(!stored||stored.state==='settled_simulated')
      return json({error:'Order is already simulated as paid',order_id:orderId},409)
    const owner=ownerType==='guest'
      ?{kind:'guest' as const,guestReference:ownerReference}
      :{kind:'profile' as const,profileId:ownerReference}
    const order=makeSandboxOrder({
      orderId,productKind:kind as ProductKind,itemReference:ref,
      trustedPriceKes:Number(stored.amount_kes),owner,idempotencyKey:key,
    })
    const reserved=await db`select commerce_sandbox.reserve_attempt(
      ${orderId}::uuid,${phone}) as id`
    attemptId=String(reserved[0]?.id||'')
    const attempt=await sendUniversalDarajaSandboxStk({
      order,phone,env,settings,
      // Atomic compare-and-swap claim. A second request cannot send again.
      hasReservedAttempt:async()=>{
        const claimed=await db`select commerce_sandbox.claim_stk_send(
          ${attemptId}::uuid) as claimed`
        return claimed[0]?.claimed===true
      },
    })
    await db`select commerce_sandbox.attach_stk(
      ${attemptId}::uuid,${attempt.checkoutRequestId},${attempt.merchantRequestId})`
    // Early callback may already be persisted before STK acknowledgement.
    await db`select commerce_sandbox.reconcile_sandbox(${attempt.checkoutRequestId})`
    return json({
      mode:'sandbox',order_id:orderId,attempt_id:attemptId,
      checkout_request_id:attempt.checkoutRequestId,
      state:'awaiting_customer',amount_kes:order.amountKes,
      message:'Sandbox STK accepted. This is not payment settlement.',
    },202)
  }catch{
    // No durable attempt means no STK was sent; don't claim that a provider
    // response needs reconciliation when the database itself was unavailable.
    // Never log connection details or private provider responses.
    if(!attemptId)return json({mode:'sandbox',attempt_id:null,
      state:'pre_payment_failure',
      message:'Failed before reserving a payment attempt. Check isolated database connectivity and catalogue.'},503)
    // Once reserved, outcome can be uncertain; do NOT resubmit STK.
    return json({mode:'sandbox',attempt_id:attemptId,
      state:'reconciliation_required',
      message:'Provider status uncertain. Check sandbox status before another request.'},409)
  }finally{await db.end({timeout:2}).catch(()=>undefined)}
})
