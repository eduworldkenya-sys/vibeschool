// Pure validation and orchestration policy for the guest M-Pesa sandbox lane.
// Does not initiate a charge, trust an inbound callback or unlock a message.
// The eventual API must use a private database transaction and a provider
// query before setting providerConfirmed=true.
import {normalizeSafaricomPhone,reconcileWishPayment,type Attempt,type ProviderCallback} from './payment-contract'

export type WishFormat='text'|'voice'|'video'
export type QuotedGuestWish={format:WishFormat;amountKes:number;currency:'KES'}
export type StkCallback={
  checkoutRequestId:string; merchantRequestId:string|null; resultCode:number
  amountKes:number|null; phone:string|null; receipt:string|null
}
export type GuestDecision='paid'|'duplicate'|'failed'|'reconciliation_required'
type Env=Record<string,string|undefined>
const FORMATS=['text','voice','video'] as const
const ID=/^[A-Za-z0-9_-]{6,160}$/
const RECEIPT=/^[A-Za-z0-9]{6,30}$/
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid M-Pesa callback.')
  return value as Record<string,unknown>
}
function namedMetadata(value:unknown):Map<string,unknown>{
  if(value===undefined||value===null)return new Map()
  const container=record(value),items=container.Item
  if(!Array.isArray(items)||items.length>20)throw Error('Invalid M-Pesa callback metadata.')
  const out=new Map<string,unknown>()
  for(const item of items){
    const row=record(item)
    if(typeof row.Name!=='string'||out.has(row.Name))throw Error('Duplicate or invalid M-Pesa metadata.')
    out.set(row.Name,row.Value)
  }
  return out
}
export function guestMpesaSandboxEnabled(env:Env=process.env):boolean{
  return env.MPESA_ENV==='sandbox'
    &&env.SUCCESS_WISHES_MPESA_GUEST_CHECKOUT_ENABLED==='true'
    &&env.SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED==='true'
    &&env.VERCEL_ENV==='preview'
    &&env.SUCCESS_WISHES_ENABLED==='true'
}
export function serverQuoteWish(format:unknown,env:Env=process.env):QuotedGuestWish{
  if(!FORMATS.includes(format as WishFormat))throw Error('Choose text, voice or video.')
  const kind=format as WishFormat
  const key=kind==='text'?'SUCCESS_WISHES_PRICE_TEXT_KES'
    :kind==='voice'?'SUCCESS_WISHES_PRICE_VOICE_KES':'SUCCESS_WISHES_PRICE_VIDEO_KES'
  const raw=env[key]
  // No price is made up or trusted from the browser.
  if(!raw||!/^[1-9]\d{0,5}$/.test(raw))throw Error('Server-side wish pricing has not been commissioned.')
  const amount=Number(raw)
  if(!Number.isSafeInteger(amount)||amount>100000)throw Error('Invalid configured wish price.')
  return {format:kind,amountKes:amount,currency:'KES'}
}
export function parseStkCallback(payload:unknown):StkCallback{
  const body=record(record(payload).Body)
  const callback=record(body.stkCallback)
  const checkout=callback.CheckoutRequestID
  const merchant=callback.MerchantRequestID
  const result=callback.ResultCode
  if(typeof checkout!=='string'||!ID.test(checkout)
    ||(merchant!==undefined&&merchant!==null&&(typeof merchant!=='string'||!ID.test(merchant)))
    ||typeof result!=='number'||!Number.isSafeInteger(result)||result<0||result>99999)
    throw Error('Invalid M-Pesa callback envelope.')
  const meta=namedMetadata(callback.CallbackMetadata)
  const amount=meta.get('Amount'),phone=meta.get('PhoneNumber'),receipt=meta.get('MpesaReceiptNumber')
  let parsedPhone:string|null=null
  if(phone!==undefined&&phone!==null){
    if(typeof phone!=='string'&&typeof phone!=='number')throw Error('Invalid callback phone.')
    parsedPhone=normalizeSafaricomPhone(String(phone))
  }
  if(amount!==undefined&&amount!==null&&(!Number.isSafeInteger(amount)||Number(amount)<=0))
    throw Error('Invalid callback amount.')
  if(receipt!==undefined&&receipt!==null&&(typeof receipt!=='string'||!RECEIPT.test(receipt)))
    throw Error('Invalid callback receipt.')
  // A result-0 callback without these fields cannot prove an amount or receipt.
  if(result===0&&(!Number.isSafeInteger(amount)||!parsedPhone||typeof receipt!=='string'))
    throw Error('Incomplete successful callback.')
  return {
    checkoutRequestId:checkout,merchantRequestId:typeof merchant==='string'?merchant:null,
    resultCode:result,amountKes:typeof amount==='number'?amount:null,
    phone:parsedPhone,receipt:typeof receipt==='string'?receipt:null,
  }
}
export function classifyVerifiedGuestCallback(input:{
  attempt:Attempt;callback:StkCallback;callbackSecretValid:boolean;
  providerQueryConfirmed:boolean
}):{decision:GuestDecision;receipt?:string;reason?:string}{
  if(!input.callbackSecretValid)return {decision:'reconciliation_required',reason:'untrusted_callback'}
  // Daraja STK callbacks are not cryptographically signed. A secret on the
  // callback URL is a routing safeguard, NOT provider settlement evidence.
  if(!input.providerQueryConfirmed)return {decision:'reconciliation_required',reason:'provider_confirmation_missing'}
  const d=reconcileWishPayment(input.attempt,{
    checkoutRequestId:input.callback.checkoutRequestId,
    merchantRequestId:input.callback.merchantRequestId,
    resultCode:input.callback.resultCode,
    amountKes:input.callback.amountKes,
    phone:input.callback.phone,
    receipt:input.callback.receipt,
  } as ProviderCallback)
  if(d.decision==='settle')return {decision:'paid',receipt:d.receipt}
  if(d.decision==='duplicate')return {decision:'duplicate'}
  if(d.decision==='fail')return {decision:'failed'}
  return {decision:'reconciliation_required',reason:d.reason}
}
