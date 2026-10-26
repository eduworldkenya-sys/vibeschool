import {NextRequest} from 'next/server'
import {field,object,WishError} from './contracts'
import {guestTextWishQuote} from './guest-checkout-contract'
import {database,limit} from './server'
import {hashSecret} from './security'
import {receiverEnabled,linkDigest,codeDigest} from './receiver'
type DB=ReturnType<typeof database>
export const orderKeyHash=(key:string)=>hashSecret('success-wishes:guest-order:'+key)
async function find(db:DB,key:string){const {data,error}=await db.from('success_wish_guest_orders').select('*').eq('key_hash',orderKeyHash(key)).maybeSingle();if(error)throw new WishError(503,'Checkout is not available yet. No new payment was requested.');return data}
async function gateway(action:string,id:string){
 const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/success-wishes-checkout',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action,id}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)})
 if(!r.ok)throw new WishError(503,'Payment service is unavailable. Your order is saved. Check status before paying again.')
}
async function present(db:DB,key:string){
 const o=await find(db,key);if(!o)throw new WishError(404,'No saved order was found for this recovery key.')
 let invitationUrl:string|null=null,backupCode:string|null=null
 if(o.state==='settled'&&!o.refunded_at){
  const secret=hashSecret('success-wishes:guest-card-link:'+key),code=hashSecret('success-wishes:guest-card-code:'+key).slice(0,32).toUpperCase()
  const {data,error}=await db.rpc('success_wish_issue_guest_card',{p_id:o.id,p_key_hash:orderKeyHash(key),p_link_hash:linkDigest(secret),p_code_hash:codeDigest(code)})
  if(error||!data)throw new WishError(503,'Payment is recorded. Card delivery is pending. Keep your recovery key and check this order again; do not pay again.')
  invitationUrl='https://vibeschool.co.ke/success-wishes/invitation#token='+secret;backupCode=code
 }
 return {id:o.id,state:o.state,amountKes:50,payerPhone:o.payer_phone,card:o.card,receipt:o.state==='settled'?o.provider_receipt:null,invitationUrl,backupCode}
}
export async function guestCheckout(req:NextRequest,raw:unknown){
 if(!receiverEnabled())throw new WishError(503,'Recipient access is not open yet. No new payment was requested.')
 const b=object(raw),key=field(b.key,64,64)
 if(!/^[a-f0-9]{64}$/.test(key))throw new WishError(400,'Invalid private order key.')
 const db=database(),ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100)
 await limit('guest-checkout:'+ip,40,60)
 if(b.action==='create'){
  const q=guestTextWishQuote({...b,idempotencyKey:key}),request=field(b.recipientRequest,64,64)
  if(!/^[a-f0-9]{64}$/.test(request))throw new WishError(400,'Open a valid private request from the recipient before paying.')
  const {data:invite,error:ie}=await db.from('success_wish_requests').select('id,receiver_id').eq('token_hash',hashSecret('success-wishes:gift-request:'+request)).is('cancelled_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(ie||!invite)throw new WishError(409,'This recipient request is unavailable. Ask for a new request link. No payment was requested.')
  const {data:r,error:re}=await db.from('success_wish_receivers').select('id,display_name,school_label,consent_status').eq('id',invite.receiver_id).maybeSingle()
  if(re||!r||r.consent_status!=='verified')throw new WishError(409,'Recipient verification is required before payment. No payment was requested.')
  if(q.card.candidate!==r.display_name||q.card.school!==r.school_label)throw new WishError(409,'The card name and school must match the recipient request. Reopen their link before checkout.')
  const matches=(o:Record<string,unknown>)=>o.card_digest===q.cardDigest&&o.payer_phone===q.payerPhone&&o.receiver_id===r.id&&o.request_id===invite.id
  const previous=await find(db,key)
  if(previous&&!matches(previous))throw new WishError(409,'This private key belongs to a different order. Restore that order first.')
  if(!previous){
   const {error}=await db.from('success_wish_guest_orders').insert({key_hash:orderKeyHash(key),request_id:invite.id,receiver_id:r.id,card:q.card,card_digest:q.cardDigest,payer_phone:q.payerPhone})
   if(error?.code==='23505'){const o=await find(db,key);if(!o||!matches(o))throw new WishError(409,'Order reference conflict. Restore your saved order.')}
   else if(error)throw new WishError(503,'Your order could not be saved. No payment was requested.')
  }
 }else if(b.action==='pay'||b.action==='status'){
  const o=await find(db,key);if(!o)throw new WishError(404,'No saved order was found for this recovery key.')
  if(b.action==='pay'){
   await limit('guest-stk:'+o.payer_phone,3,900)
   if(o.state==='created')await gateway('pay',o.id)
  }else{
   if(['submitting','awaiting_customer'].includes(o.state)&&Date.now()-Date.parse(o.updated_at)>180000){const {error}=await db.from('success_wish_guest_orders').update({state:'reconciliation_required'}).eq('id',o.id).eq('state',o.state);if(error)throw new WishError(503,'Payment status is unavailable. Do not pay again.')}
   if(['awaiting_customer','reconciliation_required'].includes(o.state)&&o.callback_event)await gateway('reconcile',o.id)
  }
 }else throw new WishError(400,'Unknown checkout action.')
 return {order:await present(db,key)}
}
