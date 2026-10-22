/**
 * Safaricom M-Pesa Express sandbox verification and callback parser.
 * No public HTTP handler and no real entitlement writer.
 * The callback body is UNTRUSTED; a success must additionally be confirmed
 * by a server-to-server Daraja STK query before simulated settlement.
 */
import {
  assertDarajaSandboxOnly, evaluateSandboxCallback, normalizeKenyanPhone,
  type SandboxAttempt, type SandboxCallback, type SandboxDecision,
} from './sandbox'
import type {DarajaSandboxSettings} from './daraja-sandbox'

const HOST='https://sandbox.safaricom.co.ke'
const REF=/^[A-Za-z0-9_:-]{6,160}$/
type Dict=Record<string,unknown>
type Fetcher=typeof fetch

function dict(value:unknown):Dict {
  if (!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Malformed Daraja response')
  return value as Dict
}
function resultCode(value:unknown):number|null {
  if (typeof value==='number'&&Number.isSafeInteger(value)) return value
  if (typeof value==='string'&&/^\d{1,6}$/.test(value)) return Number(value)
  return null
}

export type DarajaSandboxQuery = {
  checkoutRequestId:string
  merchantRequestId:string
  resultCode:number|null
  resultDescription:string
  state:'pending'|'succeeded_unverified'|'failed'|'cancelled'|'expired'|'reconciliation_required'
}

export function parseDarajaSandboxQuery(
  raw:unknown, expected:SandboxAttempt,
):DarajaSandboxQuery {
  const obj=dict(raw)
  if (obj.ResponseCode!=='0'
    || obj.CheckoutRequestID!==expected.checkoutRequestId
    || obj.MerchantRequestID!==expected.merchantRequestId) {
    throw new Error('Daraja status query identity or acknowledgement mismatch')
  }
  const code=obj.ResultCode===undefined||obj.ResultCode===null
    ?null:resultCode(obj.ResultCode)
  if (obj.ResultCode!==undefined&&obj.ResultCode!==null&&code===null)
    throw new Error('Invalid Daraja final result code')
  const state=code===null?'pending':code===0?'succeeded_unverified'
    :code===1032?'cancelled':code===1037?'expired':'failed'
  return {
    checkoutRequestId:expected.checkoutRequestId,
    merchantRequestId:expected.merchantRequestId,
    resultCode:code,
    resultDescription:typeof obj.ResultDesc==='string'?obj.ResultDesc.slice(0,256):'',
    state,
  }
}

export async function queryUniversalDarajaSandboxStk(input:{
  attempt:SandboxAttempt
  settings:DarajaSandboxSettings
  env:Record<string,string|undefined>
  fetcher?:Fetcher
  now?:()=>Date
}):Promise<DarajaSandboxQuery> {
  assertDarajaSandboxOnly(input.env)
  const a=input.attempt
  if (a.mode!=='sandbox'||!REF.test(a.checkoutRequestId)||!REF.test(a.merchantRequestId)
    ||a.state!=='awaiting_customer'&&a.state!=='reconciliation_required')
    throw new Error('Invalid sandbox attempt for status query')
  const s=input.settings
  if (!s.consumerKey?.trim()||!s.consumerSecret?.trim()||!s.passkey?.trim()
    ||!/^\d{5,7}$/.test(s.businessShortCode))
    throw new Error('Missing sandbox query credentials')
  const fetcher=input.fetcher||fetch
  async function call(path:string,init:RequestInit):Promise<Dict> {
    let response:Response
    try {
      response=await fetcher(HOST+path,{
        ...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),
      })
    } catch {
      throw new Error('Daraja status query uncertain; no payment decision allowed')
    }
    if(!response.ok)throw new Error('Daraja status query failed; no payment decision allowed')
    return dict(await response.json().catch(()=>null))
  }
  const oauth=await call('/oauth/v1/generate?grant_type=client_credentials',{
    method:'GET',headers:{Authorization:'Basic '+btoa(s.consumerKey+':'+s.consumerSecret)},
  })
  if(typeof oauth.access_token!=='string'||oauth.access_token.length<8)
    throw new Error('Invalid sandbox OAuth response')
  const now=input.now?.()||new Date()
  if(!Number.isFinite(now.getTime()))throw new Error('Invalid query timestamp')
  const timestamp=new Date(now.getTime()+3*3600000).toISOString().replace(/\D/g,'').slice(0,14)
  const query=await call('/mpesa/stkpushquery/v1/query',{
    method:'POST',headers:{
      Authorization:'Bearer '+oauth.access_token,'Content-Type':'application/json',
    },
    body:JSON.stringify({
      BusinessShortCode:s.businessShortCode,
      Password:btoa(s.businessShortCode+s.passkey+timestamp),
      Timestamp:timestamp,
      CheckoutRequestID:a.checkoutRequestId,
    }),
  })
  return parseDarajaSandboxQuery(query,a)
}

/** Strictly parse actual M-Pesa Express callback shape (not Query response). */
export function parseDarajaSandboxCallback(payload:unknown):SandboxCallback {
  const callback=dict(dict(payload).Body)
  const body=dict(callback.stkCallback)
  if(typeof body.CheckoutRequestID!=='string'||!REF.test(body.CheckoutRequestID)
    ||typeof body.MerchantRequestID!=='string'||!REF.test(body.MerchantRequestID))
    throw new Error('Invalid callback provider identifiers')
  const code=resultCode(body.ResultCode)
  if(code===null)throw new Error('Invalid callback result')
  if(code!==0) {
    return {
      checkoutRequestId:body.CheckoutRequestID,
      merchantRequestId:body.MerchantRequestID,
      resultCode:code,
      amountKes:null,phone:null,receipt:null,
    }
  }
  const metadata=dict(body.CallbackMetadata)
  if(!Array.isArray(metadata.Item)||metadata.Item.length>20)
    throw new Error('Missing sandbox payment metadata')
  const values=new Map<string,unknown>()
  for(const entry of metadata.Item) {
    const item=dict(entry)
    if(typeof item.Name!=='string'||values.has(item.Name))
      throw new Error('Duplicate or invalid payment metadata')
    values.set(item.Name,item.Value)
  }
  const amount=values.get('Amount')
  const receipt=values.get('MpesaReceiptNumber')
  const phone=values.get('PhoneNumber')
  if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<1
    ||typeof receipt!=='string'||!(/^[A-Za-z0-9]{6,30}$/).test(receipt))
    throw new Error('Invalid sandbox settlement amount or receipt')
  // Safaricom commonly sends PhoneNumber as a number.
  if(typeof phone!=='string'&&typeof phone!=='number')
    throw new Error('Missing callback payer phone')
  const normalized=normalizeKenyanPhone(String(phone))
  return {
    checkoutRequestId:body.CheckoutRequestID,
    merchantRequestId:body.MerchantRequestID,
    resultCode:0,amountKes:amount,receipt,phone:normalized,
  }
}

/**
 * Callback data alone can never settle, and a successful query alone lacks
 * the receipt + amount to settle. Both independently observed records must
 * agree. Run this behind a private service after durable event persistence.
 */
export function reconcileVerifiedDarajaSandbox(
  attempt:SandboxAttempt,
  query:DarajaSandboxQuery,
  callback:SandboxCallback|null,
):SandboxDecision {
  const quarantine=(reason:string):SandboxDecision=>({
    action:'quarantine',reason,
    attempt:{...attempt,state:'reconciliation_required'},
  })
  if(attempt.mode!=='sandbox'||attempt.state!=='awaiting_customer')
    return quarantine('attempt_not_awaiting_customer')
  if(query.checkoutRequestId!==attempt.checkoutRequestId
    ||query.merchantRequestId!==attempt.merchantRequestId)
    return quarantine('query_reference_mismatch')
  if(query.state==='pending'||query.state==='reconciliation_required')
    return quarantine('provider_not_final')
  if(query.state==='succeeded_unverified') {
    if(!callback)return quarantine('successful_query_without_callback_receipt')
    if(callback.resultCode!==0)return quarantine('callback_query_disagree')
    return evaluateSandboxCallback(attempt,callback)
  }
  // Failure or 1037 query requires no customer debit evidence. If an
  // contradictory callback exists, quarantine instead of losing evidence.
  if(callback&&(callback.checkoutRequestId!==attempt.checkoutRequestId
    ||callback.merchantRequestId!==attempt.merchantRequestId
    ||callback.resultCode===0||callback.resultCode!==query.resultCode))
    return quarantine('conflicting_failure_evidence')
  return {
    action:'fail',
    attempt:{...attempt,state:query.state==='expired'?'expired'
      :query.state==='cancelled'?'cancelled':'failed'},
  }
}
