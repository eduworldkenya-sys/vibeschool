import {NextRequest} from 'next/server'
import {field,object,WishError} from './contracts'
import {groupWishQuote} from './group-checkout'
import {guestTextWishQuote} from './guest-checkout-contract'
import {database,limit} from './server'
import {enabled,hashSecret} from './security'
import {linkDigest,codeDigest} from './receiver'
import {requestRecipient} from './receiver-collection'
import {senderPhone} from './phone-verification'
import {sixCardCodeFromOrderKey} from './card-code'
type DB=ReturnType<typeof database>
export const orderKeyHash=(key:string)=>hashSecret('success-wishes:guest-order:'+key)
async function find(db:DB,key:string){const {data,error}=await db.from('success_wish_guest_orders').select('*').eq('key_hash',orderKeyHash(key)).maybeSingle();if(error)throw new WishError(503,'Checkout is not available yet. No new payment was requested.');return data}
class GatewayRejected extends Error{constructor(readonly status:number,readonly preclaim=false){super('Payment service rejected the request.')}}
async function gateway(action:string,id:string){
 // This isolated checkout uses its own merchant settings, never the shared wallet sandbox.
 const merchant={environment:process.env.SUCCESS_WISHES_MPESA_ENV?.trim(),shortcode:process.env.SUCCESS_WISHES_MPESA_SHORTCODE?.trim(),partyB:process.env.SUCCESS_WISHES_MPESA_PARTY_B?.trim(),transactionType:process.env.SUCCESS_WISHES_MPESA_TRANSACTION_TYPE?.trim(),consumerKey:process.env.SUCCESS_WISHES_MPESA_CONSUMER_KEY?.trim(),consumerSecret:process.env.SUCCESS_WISHES_MPESA_CONSUMER_SECRET?.trim(),passkey:process.env.SUCCESS_WISHES_MPESA_PASSKEY?.trim()}
 if(Object.values(merchant).some(value=>!value||value.length>2048)||merchant.environment!=='production'||merchant.shortcode!=='961580'||merchant.partyB!=='949529'||merchant.transactionType!=='CustomerBuyGoodsOnline')throw new GatewayRejected(503,true)
 const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/success-wishes-checkout',{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),'Content-Type':'application/json'},body:JSON.stringify({action,id,merchant}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)})
 if(!r.ok){console.error('success_wishes_gateway_rejected',{action,status:r.status});throw new GatewayRejected(r.status)}
 return await r.json()
}
async function present(db:DB,key:string){
 const o=await find(db,key);if(!o)throw new WishError(404,'No saved order was found for this recovery key.')
 if(o.group_cards){
  const cards=o.group_cards as Array<Record<string,string>>
  let links:Array<{card:Record<string,string>;invitationUrl:string}>=[]
  if(o.state==='settled'&&!o.refunded_at){
   const secrets=cards.map((_,i)=>hashSecret('success-wishes:group-card-link:'+key+':'+i))
   const {error}=await db.rpc('success_wish_issue_group_gifts',{p_id:o.id,p_key_hash:orderKeyHash(key),p_links:secrets.map(linkDigest)})
   if(error)throw new WishError(503,'Payment is recorded. Keep your recovery key and check again; do not pay again.')
   links=cards.map((card,i)=>({card,invitationUrl:'https://vibeschool.co.ke/success-wishes/gift#token='+secrets[i]}))
  }
  return {id:o.id,state:o.state,amountKes:100,payerPhone:o.payer_phone,cards,links,receipt:o.state==='settled'?o.provider_receipt:null}
 }
 let invitationUrl:string|null=null,backupCode:string|null=null
 let deliveryStatus:'not_addressed'|'disabled'|'accepted'|'needs_review'='not_addressed'
 if(o.state==='settled'&&!o.refunded_at){
  const secret=hashSecret('success-wishes:guest-card-link:'+key+(o.gift_access_epoch?':'+o.gift_access_epoch:'')),code=sixCardCodeFromOrderKey(key)
  if(o.receiver_id){
   const {data,error}=await db.rpc('success_wish_issue_guest_card',{p_id:o.id,p_key_hash:orderKeyHash(key),p_link_hash:linkDigest(secret),p_code_hash:codeDigest(code)})
   if(error||!data)throw new WishError(503,'Payment is recorded. Card delivery is pending. Keep your recovery key and check again; do not pay again.')
   invitationUrl='https://vibeschool.co.ke/success-wishes/invitation#token='+secret
   // Previously issued 32-character codes must remain usable on restored orders.
   const {data:access,error:accessError}=await db.from('success_wish_card_access')
     .select('code_hash').eq('card_id',data).maybeSingle()
   if(accessError)throw new WishError(503,'Card access could not be verified. Keep your private link.')
   const originalCode=hashSecret('success-wishes:guest-card-code:'+key).slice(0,32).toUpperCase()
   backupCode=access?.code_hash===codeDigest(code) ? code
     : access?.code_hash===codeDigest(originalCode) ? originalCode : null
  }else{
   const {data,error}=await db.rpc('success_wish_issue_unrequested_guest_gift',{p_id:o.id,p_key_hash:orderKeyHash(key),p_link_hash:linkDigest(secret)})
   if(error||!data)throw new WishError(503,'Payment is confirmed. Your private gift link is being prepared. Keep your recovery key and check again; do not pay again.')
   invitationUrl='https://vibeschool.co.ke/success-wishes/gift#token='+secret
   deliveryStatus='disabled'
  }
 }
 return {id:o.id,state:o.state,amountKes:50,payerPhone:o.payer_phone,card:{...o.card,deliveryPhone:o.delivery_phone_override||o.card.deliveryPhone},receipt:o.state==='settled'?o.provider_receipt:null,invitationUrl,backupCode,deliveryStatus,inboxStatus:o.state==='settled'&&o.inbox_receiver_id?(o.inbox_opened_at?'opened':'available'):'unclaimed'}
}
export async function guestCheckout(req:NextRequest,raw:unknown){
 if(!enabled())throw new WishError(503,'Success Wishes checkout is not open yet. No new payment was requested.')
 const b=object(raw),key=field(b.key,64,64)
 if(!/^[a-f0-9]{64}$/.test(key))throw new WishError(400,'Invalid private order key.')
 const db=database(),ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100)
 await limit('guest-checkout:'+ip,40,60)
 if(b.action==='create'){
  if(b.group===true){
   if(b.inboxRequest!==undefined||b.recipientRequest!==undefined)throw new WishError(400,'Group orders use individual private gift links.')
   const q=groupWishQuote(b,key),previous=await find(db,key)
   const matches=(o:Record<string,unknown>)=>o.card_digest===q.digest&&o.payer_phone===q.payerPhone&&o.amount_kes===100&&o.group_cards!=null
   if(previous&&!matches(previous))throw new WishError(409,'This recovery key belongs to another order.')
   if(!previous){
    const {error}=await db.from('success_wish_guest_orders').insert({key_hash:orderKeyHash(key),card:q.cards[0],group_cards:q.cards,card_digest:q.digest,payer_phone:q.payerPhone,amount_kes:100,delivery_link_hashes:q.cards.map((_,i)=>linkDigest(hashSecret('success-wishes:group-card-link:'+key+':'+i)))})
    if(error?.code==='23505'){const saved=await find(db,key);if(!saved||!matches(saved))throw new WishError(409,'Order reference conflict.')}
    else if(error)throw new WishError(503,'Your order could not be saved. No payment was requested.')
   }
   return {order:await present(db,key)}
  }
  const q=guestTextWishQuote({...b,idempotencyKey:key})
  // The sender chooses who the gift is for; a recipient request or registration is never required.
  if(b.recipientRequest!==undefined)throw new WishError(400,'A recipient request is not part of gift checkout.')
  const target=await requestRecipient(db,b.inboxRequest,q.card)
  const requestHash=target?hashSecret('success-wishes:gift-request:'+String(b.inboxRequest)):null
  const matches=(o:Record<string,unknown>)=>o.card_digest===q.cardDigest&&o.payer_phone===q.payerPhone&&o.receiver_id==null&&o.request_id==null&&((o.inbox_request_hash||null)===requestHash)
  const previous=await find(db,key)
  if(previous&&!matches(previous))throw new WishError(409,'This private key belongs to a different order. Restore that order first.')
  if(!previous){
   const {error}=await db.from('success_wish_guest_orders').insert({key_hash:orderKeyHash(key),card:q.card,card_digest:q.cardDigest,payer_phone:q.payerPhone,inbox_receiver_id:target,inbox_request_hash:requestHash,delivery_link_hashes:[linkDigest(hashSecret('success-wishes:guest-card-link:'+key))]})
   if(error?.code==='23505'){const o=await find(db,key);if(!o||!matches(o))throw new WishError(409,'Order reference conflict. Restore your saved order.')}
   else if(error)throw new WishError(503,'Your order could not be saved. No payment was requested.')
  }
 }else if(b.action==='correct_address'){
  const phone=senderPhone(b.phone),o=await find(db,key);if(o?.group_cards)throw new WishError(400,'Contact support to correct a group recipient.');if(!o)throw new WishError(404,'Order not found.')
  const epoch=o.gift_access_epoch||0,next=hashSecret('success-wishes:guest-card-link:'+key+':'+(epoch+1))
  const {data,error}=await db.rpc('success_wish_pin_correct_address',{p_key:orderKeyHash(key),p_phone:phone,p_epoch:epoch,p_link:linkDigest(next)})
  if(error||data!==true)throw new WishError(409,'This gift has been opened or claimed. Contact support to correct its address.')
 }else if(b.action==='pay'||b.action==='status'){
  const o=await find(db,key);if(!o)throw new WishError(404,'No saved order was found for this recovery key.')
  if(b.action==='pay'){
   await limit('guest-stk:'+o.payer_phone,3,900)
   if(o.state==='created'){
    try{await gateway('pay',o.id)}catch(error){
     // A completed auth denial cannot reach a payment claim. A timeout may still be running.
     if(!(error instanceof GatewayRejected)||!error.preclaim&&![401,403].includes(error.status))throw new WishError(503,'Payment status couldn’t be checked.')
     const current=await present(db,key)
     return {order:current,paymentError:current.state==='created'?'Payment couldn’t start.':null}
    }
   }
  }else{
   if(['submitting','awaiting_customer'].includes(o.state)&&Date.now()-Date.parse(o.updated_at)>180000){const {error}=await db.from('success_wish_guest_orders').update({state:'reconciliation_required'}).eq('id',o.id).eq('state',o.state);if(error)throw new WishError(503,'Payment status is unavailable. Do not pay again.')}
   if(['awaiting_customer','reconciliation_required'].includes(o.state)&&o.callback_event)await gateway('reconcile',o.id)
  }
 }else throw new WishError(400,'Unknown checkout action.')
 return {order:await present(db,key)}
}

/** Read-only operational probe. Never creates an order or invokes STK Push. */
export async function guestCheckoutReadiness(req:NextRequest){
 if(!enabled())throw new WishError(503,'Payment is unavailable.')
 const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100)
 await limit('guest-checkout-health:'+ip,5,60)
 const {data:control,error}=await database().from('mpesa_runtime_control').select('initiation_enabled,success_wishes_enabled').eq('singleton',true).maybeSingle()
 if(error||!control?.initiation_enabled||!control?.success_wishes_enabled)throw new WishError(503,'Payment is unavailable.')
 const health=await gateway('health','00000000-0000-0000-0000-000000000000')
 if(health.ready!==true)throw new WishError(503,'Payment is unavailable.')
 return {ready:true}
}
