/**
 * Isolated Daraja M-Pesa Express sandbox callback ingress.
 *
 * Transport-independent handler, intentionally NOT exposed as a public route.
 * The concrete checkout/callback Edge Function must wire a private durable
 * store in an isolated Supabase project. A callback is never self-authenticating;
 * even after checking its unguessable ingress token we query Daraja ourselves.
 */
import {
  assertDarajaSandboxOnly,
  type SandboxAttempt, type SandboxCallback,
} from './sandbox'
import {
  parseDarajaSandboxCallback,reconcileVerifiedDarajaSandbox,
  type DarajaSandboxQuery,
} from './daraja-reconciliation'

export type SandboxCallbackStore = {
  /** Commit immutable callback evidence BEFORE acknowledging the provider. */
  persistCallback:(event:{key:string;callback:SandboxCallback})=>Promise<void>
  findAttempt:(checkoutRequestId:string)=>Promise<SandboxAttempt|null>
  /** Query result must have been received directly from Daraja by the server. */
  persistQuery:(query:DarajaSandboxQuery)=>Promise<void>
  /** Database transaction must lock the order+attempt and be idempotent. */
  reconcile:(checkoutRequestId:string)=>Promise<string>
}
export type SandboxCallbackOptions = {
  env:Record<string,string|undefined>
  store:SandboxCallbackStore
  /** Server-to-server STK query, not caller-provided status. */
  queryProvider:(attempt:SandboxAttempt)=>Promise<DarajaSandboxQuery>
}
function reply(status:number,desc:string) {
  return new Response(JSON.stringify({ResultCode:status===200?0:1,ResultDesc:desc}),{
    status,
    headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  })
}
async function hash(input:string):Promise<string> {
  const bytes=new TextEncoder().encode(input)
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')
}
async function tokenEqual(got:string,expected:string):Promise<boolean> {
  if(!got||!expected||got.length>256||expected.length<32||expected.length>256)
    return false
  const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(got)))
  const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected)))
  let diff=0
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i]
  return diff===0
}
export async function handleDarajaSandboxCallback(req:Request,input:SandboxCallbackOptions):Promise<Response> {
  try { assertDarajaSandboxOnly(input.env) }
  catch { return reply(503,'Sandbox callback disabled') }
  if(req.method!=='POST')return reply(405,'Method not allowed')
  const url=new URL(req.url)
  const secret=input.env.COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN||''
  // Safaricom does not sign M-Pesa Express callbacks. An opaque callback URL
  // token only gates receipt; provider query supplies independent confirmation.
  if(!await tokenEqual(url.searchParams.get('sandbox_token')||'',secret))
    return reply(401,'Unauthorized')
  if(req.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    return reply(415,'Expected JSON')
  if(Number(req.headers.get('content-length')||'0')>12000)
    return reply(413,'Payload too large')
  let raw:string
  try {raw=await req.text()} catch{return reply(400,'Invalid callback body')}
  if(raw.length>12000)return reply(413,'Payload too large')
  let callback:SandboxCallback
  try {callback=parseDarajaSandboxCallback(JSON.parse(raw))}
  catch {return reply(400,'Invalid M-Pesa Express callback')}
  const key=await hash(JSON.stringify([
    callback.checkoutRequestId,callback.merchantRequestId,
    callback.resultCode,callback.amountKes,callback.phone,callback.receipt,
  ]))
  try {await input.store.persistCallback({key:'daraja-sb:'+key,callback})}
  catch{return reply(503,'Cannot persist callback evidence')}
  let attempt:SandboxAttempt|null
  try {attempt=await input.store.findAttempt(callback.checkoutRequestId)}
  catch {return reply(200,'Persisted for reconciliation')}
  if(!attempt)return reply(200,'Persisted: early callback')
  try {
    const query=await input.queryProvider(attempt)
    await input.store.persistQuery(query)
    const decision=reconcileVerifiedDarajaSandbox(attempt,query,callback)
    if(decision.action==='quarantine')return reply(200,'Saved for manual reconciliation')
    await input.store.reconcile(callback.checkoutRequestId)
  } catch {
    // Evidence already durable. A reconciliation worker must retry the
    // provider STATUS QUERY, not blindly re-initiate the original STK Push.
    return reply(200,'Persisted for reconciliation')
  }
  return reply(200,'Accepted')
}
