// Server-only Safaricom transport for a future canonical guest-wish order.
// This never owns an order, creates a paid message, handles a callback or settles money.
// The caller must lock a durable canonical attempt and re-check the shared runtime
// kill switch BEFORE calling sendStk; an HTTP acknowledgement is NOT settlement.
import {normalizeSafaricomPhone} from './payment-contract'

type Env = Record<string,string|undefined>
type Fetcher = typeof fetch
type Json = Record<string,unknown>
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CHECKOUT=/^[A-Za-z0-9_-]{6,160}$/
// Guest wishes must not inherit generic M-Pesa keys shared by other VibeSchool products.
const REQUIRED=[
  'SUCCESS_WISHES_MPESA_CONSUMER_KEY','SUCCESS_WISHES_MPESA_CONSUMER_SECRET',
  'SUCCESS_WISHES_MPESA_SHORTCODE','SUCCESS_WISHES_MPESA_PASSKEY',
  'SUCCESS_WISHES_MPESA_PARTY_B','SUCCESS_WISHES_MPESA_TRANSACTION_TYPE',
  'SUCCESS_WISHES_MPESA_ENV','SUCCESS_WISHES_MPESA_CALLBACK_URL',
] as const
const PRODUCTION_SHORTCODE='961580'
const PRODUCTION_TILL='949529'
const PRODUCTION_CALLBACK_HOST='yauqsxggtuxuykcbrtzf.supabase.co'

function object(value:unknown):Json {
  if (!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid M-Pesa provider response.')
  return value as Json
}
function config(env:Env) {
  if (env.SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED!=='true') throw new Error('Guest M-Pesa transport is disabled.')
  for(const key of REQUIRED) if(!env[key]?.trim()) throw new Error('Guest M-Pesa provider configuration incomplete.')
  const environment=env.SUCCESS_WISHES_MPESA_ENV!.trim()
  if(environment!=='sandbox'&&environment!=='production')throw new Error('M-Pesa environment not configured.')
  const shortcode=env.SUCCESS_WISHES_MPESA_SHORTCODE!.trim()
  const partyB=env.SUCCESS_WISHES_MPESA_PARTY_B!.trim()
  const transactionType=env.SUCCESS_WISHES_MPESA_TRANSACTION_TYPE!.trim()
  if(!/^\d{5,7}$/.test(shortcode)||!/^\d{5,7}$/.test(partyB))
    throw new Error('Invalid M-Pesa merchant number.')
  if(environment==='production' &&
    (shortcode!==PRODUCTION_SHORTCODE||partyB!==PRODUCTION_TILL||transactionType!=='CustomerBuyGoodsOnline'))
    throw new Error('Production M-Pesa merchant configuration mismatch.')
  // Safaricom's sandbox STK test merchant is Paybill-style. It must never be mixed
  // with production Buy Goods credentials or with a real receiving Till.
  if(environment==='sandbox' &&
    (shortcode!=='174379'||partyB!=='174379'||transactionType!=='CustomerPayBillOnline'))
    throw new Error('Sandbox M-Pesa merchant configuration mismatch.')
  const callback=new URL(env.SUCCESS_WISHES_MPESA_CALLBACK_URL!)
  if(callback.protocol!=='https:'||!callback.hostname.endsWith('.supabase.co')
    ||callback.username||callback.password||callback.port||callback.hash||callback.search
    ||callback.pathname!=='/functions/v1/success-wishes-mpesa-callback'
    ||(environment==='production'&&callback.hostname!==PRODUCTION_CALLBACK_HOST))
    throw new Error('M-Pesa callback must be the dedicated HTTPS Supabase endpoint.')
  return {
    host:environment==='sandbox'?'https://sandbox.safaricom.co.ke':'https://api.safaricom.co.ke',
    consumerKey:env.SUCCESS_WISHES_MPESA_CONSUMER_KEY!.trim(),
    consumerSecret:env.SUCCESS_WISHES_MPESA_CONSUMER_SECRET!.trim(),
    shortcode,partyB,transactionType,
    passkey:env.SUCCESS_WISHES_MPESA_PASSKEY!.trim(),
    callback:callback.href,
  }
}
export function guestMpesaTransportReady(env:Env=process.env):boolean {
  if(typeof window!=='undefined')return false
  try{config(env);return true}catch{return false}
}
export type ClaimedWishAttempt = {
  id:string
  phone:string
  amountKes:number
  state:'submitting'
}
export type StkAcknowledgement = {
  checkoutRequestId:string
  merchantRequestId:string
  customerMessage:string
  state:'awaiting_customer'
}
export function createGuestMpesaTransport(options:{
  env?:Env;request?:Fetcher;now?:()=>Date
}={}) {
  if(typeof window!=='undefined')throw new Error('M-Pesa transport is server-only.')
  const env=options.env??process.env
  const request=options.request??fetch
  const now=options.now??(()=>new Date())
  async function call(url:string,init:RequestInit):Promise<Json> {
    let response:Response
    try{
      response=await request(url,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
    }catch {throw new Error('M-Pesa provider could not be reached. Reconciliation is required before retrying.')}
    if(!response.ok)throw new Error('M-Pesa provider rejected the request. Check its status before retrying.')
    let data:Json
    try {data=object(await response.json())}
    catch{throw new Error('M-Pesa provider returned an invalid response. Reconcile before retrying.')}
    return data
  }
  return {
    // An acknowledged STK request must be durably attached to the locked
    // attempt. A timeout may STILL have issued an STK; never blindly retry.
    async sendStk(attempt:ClaimedWishAttempt,canonicalClaimAndKillSwitch:()=>Promise<boolean>):Promise<StkAcknowledgement> {
      const settings=config(env)
      if(!UUID.test(attempt.id)||attempt.state!=='submitting'
        ||!Number.isSafeInteger(attempt.amountKes)||attempt.amountKes<1||attempt.amountKes>100000)
        throw new Error('Invalid locked guest payment attempt.')
      const phone=normalizeSafaricomPhone(attempt.phone)
      if(await canonicalClaimAndKillSwitch()!==true)throw new Error('Canonical M-Pesa initiation is disabled.')
      const oauth=await call(settings.host+'/oauth/v1/generate?grant_type=client_credentials',{
        method:'GET',
        headers:{Authorization:'Basic '+btoa(settings.consumerKey+':'+settings.consumerSecret)},
      })
      const access=oauth.access_token
      if(typeof access!=='string'||access.length<8)throw new Error('M-Pesa authorization was not confirmed.')
      // Daraja interprets this password timestamp in Africa/Nairobi (UTC+3), not UTC.
      const timestamp=new Date(now().getTime()+3*60*60*1000).toISOString().replace(/\D/g,'').slice(0,14)
      if(!/^\d{14}$/.test(timestamp))throw new Error('Invalid M-Pesa timestamp.')
      const password=btoa(settings.shortcode+settings.passkey+timestamp)
      const stk=await call(settings.host+'/mpesa/stkpush/v1/processrequest',{
        method:'POST',
        headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
        body:JSON.stringify({
          BusinessShortCode:settings.shortcode,Password:password,Timestamp:timestamp,
          TransactionType:settings.transactionType,Amount:attempt.amountKes,
          PartyA:phone,PartyB:settings.partyB,PhoneNumber:phone,
          CallBackURL:settings.callback,AccountReference:'VW'+attempt.id.replace(/-/g,'').slice(0,10),
          TransactionDesc:'Success Wish',
        }),
      })
      if(stk.ResponseCode!=='0'||typeof stk.CheckoutRequestID!=='string'
        ||!CHECKOUT.test(stk.CheckoutRequestID)||typeof stk.MerchantRequestID!=='string'
        ||!CHECKOUT.test(stk.MerchantRequestID))
        throw new Error('M-Pesa did not confirm an STK request. Reconcile before retrying.')
      return {
        checkoutRequestId:stk.CheckoutRequestID,
        merchantRequestId:stk.MerchantRequestID,
        customerMessage:typeof stk.CustomerMessage==='string'?stk.CustomerMessage.slice(0,250):'Check your phone to complete the M-Pesa request.',
        state:'awaiting_customer',
      }
    },
  }
}
