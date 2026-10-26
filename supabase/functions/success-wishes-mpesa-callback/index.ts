import {createClient} from 'npm:@supabase/supabase-js@2.43.4'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('')
const reply=(status=200)=>new Response(JSON.stringify({ResultCode:status===200?0:1,ResultDesc:status===200?'Accepted':'Rejected'}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405)
 try{
  const u=new URL(req.url),id=u.searchParams.get('id'),token=u.searchParams.get('token')||''
  if(!id||!/^[a-f0-9]{64}$/.test(token))return reply(403)
  const {data:o,error}=await db.from('success_wish_guest_orders').select('id,state,checkout_id,merchant_id,callback_event').eq('id',id).eq('callback_hash',await hash(token)).maybeSingle()
  if(error||!o)return reply(403)
  if(Number(req.headers.get('content-length'))>16000)return reply(413)
  const reader=req.body?.getReader();if(!reader)return reply(400)
  const chunks:Uint8Array[]=[];let size=0
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return reply(413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const raw=JSON.parse(new TextDecoder().decode(bytes))?.Body?.stkCallback
  if(!raw||typeof raw.CheckoutRequestID!=='string'||typeof raw.MerchantRequestID!=='string'||!Number.isInteger(raw.ResultCode))return reply(400)
  if(o.checkout_id&&o.checkout_id!==raw.CheckoutRequestID||o.merchant_id&&o.merchant_id!==raw.MerchantRequestID)return reply(403)
  if(o.callback_event)return reply()
  const items=Array.isArray(raw.CallbackMetadata?.Item)?raw.CallbackMetadata.Item:[]
  const item=(name:string)=>items.find((i:{Name?:string})=>i.Name===name)?.Value
  const event={checkout:raw.CheckoutRequestID,merchant:raw.MerchantRequestID,resultCode:raw.ResultCode,amount:item('Amount')??null,phone:item('PhoneNumber')??null,receipt:item('MpesaReceiptNumber')??null,receivedAt:new Date().toISOString()}
  const {error:se}=await db.from('success_wish_guest_orders').update({callback_event:event}).eq('id',id).is('callback_event',null).in('state',['submitting','awaiting_customer','reconciliation_required'])
  if(se)return reply(503)
  return reply() // Evidence only. An authenticated provider query must independently confirm settlement.
 }catch{return reply(400)}
})
