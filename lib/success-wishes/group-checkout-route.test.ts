import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../../app/api/success-wishes/checkout/route'
import {orderKeyHash} from './guest-checkout'
const origin='https://vibeschool.example',key='b'.repeat(64)
test('group checkout locks snapshots, preserves payment, recovers missing links and never repays',async()=>{
 const saved={...process.env},original=fetch
 let order:Record<string,unknown>|null=null,inserts=0,prompts=0,failIssue=false
 const links=new Set<string>()
 globalThis.fetch=(async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  assert.equal(u.hostname,'synthetic.supabase.co')
  const endpoint=u.pathname.split('/').at(-1),body=init?.body?JSON.parse(String(init.body)):{}
  if(endpoint==='success_wishes_take_attempt')return Response.json(true)
  if(endpoint==='success_wish_guest_orders'){
   if(init?.method==='POST'){inserts++;order={...body,id:'44444444-4444-4444-8444-444444444444',state:'created',updated_at:new Date().toISOString()};return new Response(null,{status:201})}
   assert.equal(u.searchParams.get('key_hash'),'eq.'+orderKeyHash(key));return Response.json(order)
  }
  if(endpoint==='success-wishes-checkout'){assert.equal(body.action,'pay');assert.equal(order?.state,'created');prompts++;Object.assign(order!,{state:'awaiting_customer'});return Response.json({ok:true})}
  if(endpoint==='success_wish_issue_group_gifts'){
   assert.equal(order?.state,'settled');assert.equal(body.p_links.length,3)
   if(failIssue)return Response.json({message:'Synthetic transient issue'},{status:503})
   body.p_links.forEach((link:string)=>links.add(link));return Response.json(true)
  }
  throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 const call=(b:Record<string,unknown>)=>POST(new NextRequest(origin+'/api/success-wishes/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({key,...b})}))
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',SUCCESS_WISHES_MPESA_ENV:'production',SUCCESS_WISHES_MPESA_SHORTCODE:'961580',SUCCESS_WISHES_MPESA_PARTY_B:'949529',SUCCESS_WISHES_MPESA_TRANSACTION_TYPE:'CustomerBuyGoodsOnline',SUCCESS_WISHES_MPESA_CONSUMER_KEY:'dedicated-key',SUCCESS_WISHES_MPESA_CONSUMER_SECRET:'dedicated-secret',SUCCESS_WISHES_MPESA_PASSKEY:'dedicated-passkey'})
  const students=['Mary','Brian','Faith'].map(candidate=>({candidate,theme:'nightfall',message:'Personal wish for '+candidate,school:'',examYear:'2026',deliveryPhone:'0733000111'}))
  const create={action:'create',group:true,sender:'Mum',payerPhone:'0712345678',students}
  assert.equal((await call(create)).status,200);assert.equal(inserts,1);assert.equal(prompts,0)
  assert.equal((await call(create)).status,200);assert.equal(inserts,1)
  assert.equal((await call({...create,students:students.slice(0,2)})).status,409)
  assert.equal((await call({...create,sender:'Different sender'})).status,409)
  assert.equal((await call({...create,amountKes:50})).status,400)
  assert.equal((await call({action:'pay'})).status,200);assert.equal((await call({action:'pay'})).status,200);assert.equal(prompts,1)
  assert.deepEqual((await (await call({action:'status'})).json()).order.links,[])
  Object.assign(order!,{state:'settled',provider_receipt:'SYNTHETIC'})
  failIssue=true;const failed=await call({action:'status'});assert.equal(failed.status,503);assert.match((await failed.json()).error,/Payment is recorded/)
  failIssue=false;const first=(await (await call({action:'status'})).json()).order
  assert.equal(first.links.length,3);assert.equal(links.size,3)
  assert.deepEqual(first.links.map((x:{card:{candidate:string}})=>x.card.candidate),['Mary','Brian','Faith'])
  const restored=(await (await call({action:'pay'})).json()).order;assert.deepEqual(restored.links,first.links);assert.equal(prompts,1)
  Object.assign(order!,{state:'refunded',refunded_at:new Date().toISOString()})
  assert.deepEqual((await (await call({action:'status'})).json()).order.links,[])
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
