import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../../app/api/success-wishes/checkout/route'
import {orderKeyHash} from './guest-checkout'
import {hashSecret} from './security'
const url='https://vibeschool.example/api/success-wishes/checkout'
test('checkout rejects cross-origin payment requests before database/provider access',async()=>{
 const r=await POST(new NextRequest(url,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({action:'pay',key:'a'.repeat(64)})}));assert.equal(r.status,403)
})
test('enabled checkout preserves one immutable order, never repeats a pending STK, and restores paid delivery',async()=>{
 const saved={...process.env},original=globalThis.fetch,key='a'.repeat(64),requestToken='b'.repeat(64)
 const receiverId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333'
 type Row=Record<string,unknown>
 let order:Row|null=null,prompts=0,issues=0,consent='verified'
 const card={version:'text',theme:'nightfall',candidate:'Synthetic recipient',sender:'Synthetic sender',message:'Exact synthetic wish.',examYear:'2026',school:''}
 globalThis.fetch=(async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  assert.equal(u.hostname,'synthetic.supabase.co','No real network permitted')
  const endpoint=u.pathname.split('/').at(-1),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):{}
  if(endpoint==='success_wishes_take_attempt')return Response.json(true)
  if(endpoint==='success_wish_requests'){
   assert.equal(u.searchParams.get('token_hash'),'eq.'+hashSecret('success-wishes:gift-request:'+requestToken))
   return Response.json({id:requestId,receiver_id:receiverId})
  }
  if(endpoint==='success_wish_receivers')return Response.json({id:receiverId,display_name:card.candidate,school_label:'',consent_status:consent})
  if(endpoint==='success_wish_guest_orders'){
   if(method==='POST'){assert.equal(order,null);order={...body,id:'44444444-4444-4444-8444-444444444444',state:'created',updated_at:new Date().toISOString()};return new Response(null,{status:201})}
   assert.equal(u.searchParams.get('key_hash'),'eq.'+orderKeyHash(key));return Response.json(order)
  }
  if(endpoint==='success-wishes-checkout'){
   assert.equal(body.action,'pay');assert.equal(order?.state,'created');prompts++;Object.assign(order!,{state:'awaiting_customer'});return Response.json({ok:true})
  }
  if(endpoint==='success_wish_issue_guest_card'){assert.equal(order?.state,'settled');issues++;return Response.json('55555555-5555-4555-8555-555555555555')}
  throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 const call=(body:Row)=>POST(new NextRequest(url,{method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},body:JSON.stringify({key,...body})}))
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',SUCCESS_WISHES_RECEIVER_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})
  const create={action:'create',...card,payerPhone:'0712345678',recipientRequest:requestToken}
  assert.equal((await call({...create,paid:true})).status,400);assert.equal(order,null)
  consent='pending';assert.equal((await call(create)).status,409);assert.equal(order,null)
  consent='verified';assert.equal((await call({...create,candidate:'Another recipient'})).status,409)
  assert.equal((await call(create)).status,200);assert.equal(prompts,0)
  assert.equal((await call(create)).status,200)
  assert.equal((await call({...create,message:'Changed retry'})).status,409)
  assert.equal((await call({action:'pay'})).status,200)
  assert.equal((await call({action:'pay'})).status,200);assert.equal(prompts,1)
  const pending=await (await call({action:'status'})).json();assert.equal(pending.order.invitationUrl,null);assert.equal(issues,0)
  Object.assign(order!,{state:'settled',provider_receipt:'SYNTHETIC123'})
  const first=await (await call({action:'status'})).json(),restored=await (await call({action:'status'})).json()
  assert.equal(first.order.receipt,'SYNTHETIC123');assert.equal(first.order.card.message,card.message)
  assert.match(first.order.invitationUrl,/^https:\/\/vibeschool.co.ke\/success-wishes\/invitation#token=[a-f0-9]{64}$/)
  assert.equal(first.order.invitationUrl,restored.order.invitationUrl);assert.equal(first.order.backupCode,restored.order.backupCode)
  Object.assign(order!,{state:'refunded',refunded_at:new Date().toISOString()})
  assert.equal((await (await call({action:'status'})).json()).order.invitationUrl,null)
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
test('disabled recipient service cannot start checkout or accept a fake receipt',async()=>{
 const old=process.env.SUCCESS_WISHES_RECEIVER_ENABLED
 try{delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED
 for(const action of ['create','pay','status']){const r=await POST(new NextRequest(url,{method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},body:JSON.stringify({action,key:'a'.repeat(64),paid:true,receipt:'FORGED'})}));assert.equal(r.status,503);assert.equal(Object.hasOwn(await r.json(),'order'),false)}
 }finally{if(old===undefined)delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED;else process.env.SUCCESS_WISHES_RECEIVER_ENABLED=old}
})
