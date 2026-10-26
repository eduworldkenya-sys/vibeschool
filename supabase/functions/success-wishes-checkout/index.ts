import {createClient} from 'npm:@supabase/supabase-js@2.43.4'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('')
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
async function provider(path:string,body:Record<string,unknown>){
 if(Deno.env.get('MPESA_ENV')!=='production'||Deno.env.get('MPESA_SHORTCODE')!=='961580'||Deno.env.get('MPESA_PARTY_B')!=='949529'||Deno.env.get('MPESA_TRANSACTION_TYPE')!=='CustomerBuyGoodsOnline')throw Error('Merchant configuration mismatch')
 const key=Deno.env.get('MPESA_CONSUMER_KEY')?.trim(),secret=Deno.env.get('MPESA_CONSUMER_SECRET')?.trim(),passkey=Deno.env.get('MPESA_PASSKEY')?.trim()
 if(!key||!secret||!passkey)throw Error('Provider unavailable')
 const oauth=await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+btoa(key+':'+secret)},redirect:'error',signal:AbortSignal.timeout(10000)})
 const auth=await oauth.json();if(!oauth.ok||typeof auth.access_token!=='string')throw Error('Authorization unavailable')
 const timestamp=new Date(Date.now()+10800000).toISOString().replace(/\D/g,'').slice(0,14)
 const r=await fetch('https://api.safaricom.co.ke'+path,{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:'961580',Password:btoa('961580'+passkey+timestamp),Timestamp:timestamp,...body}),redirect:'error',signal:AbortSignal.timeout(15000)})
 if(!r.ok)throw Error('Provider request unavailable');return await r.json()
}
async function update(id:string,values:Record<string,unknown>,states:string[]){
 const {error}=await db.from('success_wish_guest_orders').update({...values,updated_at:new Date().toISOString()}).eq('id',id).in('state',states);if(error)throw error
}
async function reconcile(id:string){
 const {data:o,error}=await db.from('success_wish_guest_orders').select('*').eq('id',id).single()
 if(error||!o)throw Error('Order unavailable')
 if(['settled','refunded','failed'].includes(o.state)||!o.callback_event||!o.checkout_id||Date.now()-Date.parse(o.updated_at)<10000)return
 const e=o.callback_event;if(e.checkout!==o.checkout_id||e.merchant!==o.merchant_id)return
 const q=await provider('/mpesa/stkpushquery/v1/query',{CheckoutRequestID:o.checkout_id})
 if(q.CheckoutRequestID!==o.checkout_id||q.MerchantRequestID!==o.merchant_id||String(q.ResponseCode)!=='0'||!/^\d+$/.test(String(q.ResultCode)))return
 if(Number(q.ResultCode)!==0){if(Number(q.ResultCode)===e.resultCode)await update(id,{state:'failed'},['awaiting_customer','reconciliation_required']);return}
 if(e.resultCode!==0||e.amount!==50||String(e.phone)!==o.payer_phone||typeof e.receipt!=='string'||!/^[A-Z0-9]{6,30}$/.test(e.receipt)){
  await update(id,{state:'reconciliation_required'},['awaiting_customer']);return
 }
 await update(id,{state:'settled',provider_query:{ResponseCode:String(q.ResponseCode),ResultCode:String(q.ResultCode),CheckoutRequestID:q.CheckoutRequestID,MerchantRequestID:q.MerchantRequestID},provider_receipt:e.receipt,provider_verified_at:new Date().toISOString(),settled_at:new Date().toISOString()},['awaiting_customer','reconciliation_required'])
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 // Gateway validation plus exact service credential: authenticated users cannot call this endpoint.
 if(req.headers.get('authorization')!=='Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))return reply({error:'Unauthorized'},401)
 try{
  const b=await req.json();if(!/^[0-9a-f-]{36}$/.test(b.id))return reply({error:'Invalid order'},400)
  if(b.action==='reconcile'){await reconcile(b.id);return reply({ok:true})}
  if(b.action!=='pay')return reply({error:'Invalid action'},400)
  const callbackToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')
  const {data:claimed,error:ce}=await db.rpc('success_wish_claim_guest_payment',{p_id:b.id,p_callback_hash:await hash(callbackToken)})
  if(ce||!claimed)return reply({error:'Payment initiation is unavailable for this order'},409)
  const {data:o,error}=await db.from('success_wish_guest_orders').select('*').eq('id',b.id).single()
  if(error||!o||o.state!=='submitting'||o.amount_kes!==50)throw Error('Claim unavailable')
  try{
   const a=await provider('/mpesa/stkpush/v1/processrequest',{TransactionType:'CustomerBuyGoodsOnline',Amount:50,PartyA:o.payer_phone,PartyB:'949529',PhoneNumber:o.payer_phone,CallBackURL:Deno.env.get('SUPABASE_URL')+'/functions/v1/success-wishes-mpesa-callback?id='+o.id+'&token='+callbackToken,AccountReference:'VW'+o.id.replace(/-/g,'').slice(0,10),TransactionDesc:'Success Wish'})
   if(String(a.ResponseCode)!=='0'||typeof a.CheckoutRequestID!=='string'||typeof a.MerchantRequestID!=='string')throw Error('Ambiguous provider response')
   await update(o.id,{state:'awaiting_customer',checkout_id:a.CheckoutRequestID,merchant_id:a.MerchantRequestID},['submitting'])
  }catch{await update(o.id,{state:'reconciliation_required'},['submitting'])} // Never retry an ambiguous external side effect.
  return reply({ok:true})
 }catch{return reply({error:'Payment could not be checked. Keep the order reference and do not pay again.'},503)}
})
