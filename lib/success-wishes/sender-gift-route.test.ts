import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { POST, PUT } from '../../app/api/success-wishes/gift/route'
import { hashSecret } from './security'
const url='https://vibeschool.example/api/success-wishes/gift'
const token='a'.repeat(64)
test('sender-created private gift stays sealed until opened and rejects invalid/refunded orders',async()=>{
 const env={...process.env},oldFetch=globalThis.fetch
 let refunded=false,free=false,revoked=false,calls=0
 const card={kind:'success_wish_text',theme:'heritage',candidate:'Synthetic learner',sender:'Hidden sender',message:'Exact secret message',school:'',examYear:'2026'}
 globalThis.fetch=(async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  assert.equal(u.hostname,'synthetic.supabase.co')
  const endpoint=u.pathname.split('/').at(-1)
  if(endpoint==='success_wish_pin_open_gift')return Response.json(!refunded)
  if(endpoint==='success_wishes_take_attempt')return Response.json(true)
  if(endpoint==='success_wish_guest_gifts'){
   calls++
   if(free || u.searchParams.get('link_hash')!=='eq.'+hashSecret('success-wishes:paid-link:'+token))return Response.json(null)
   return Response.json({id:'11111111-1111-4111-8111-111111111111',guest_order_id:'22222222-2222-4222-8222-222222222222',expires_at:new Date(Date.now()+86400000).toISOString()})
  }
  if(endpoint==='success_wish_free_gifts')return Response.json(free&&!revoked?{id:'33333333-3333-4333-8333-333333333333',card,expires_at:new Date(Date.now()+86400000).toISOString()}:null)
  if(endpoint==='success_wish_guest_orders')return Response.json({state:refunded?'refunded':free?'free_issued':'settled',card,amount_kes:free?0:50,receiver_id:null,provider_receipt:free?null:'SYNTHETIC123',provider_verified_at:free?null:new Date().toISOString(),settled_at:free?null:new Date().toISOString(),refunded_at:refunded?new Date().toISOString():null})
  throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 const request=(method:'POST'|'PUT',value=token,origin='https://vibeschool.example')=>
  new NextRequest(url,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:value})})
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})
  assert.equal((await POST(request('POST',token,'https://evil.example'))).status,403)
  assert.equal((await POST(request('POST','bad'))).status,404)
  const sealed=await POST(request('POST'));assert.equal(sealed.status,200)
  const preview=(await sealed.json()).card
  assert.equal(preview.candidate,card.candidate);assert.equal(preview.sender,null);assert.equal(Object.hasOwn(preview,'message'),false)
  const opened=await PUT(request('PUT'));assert.equal(opened.status,200)
  const reveal=(await opened.json()).card;assert.equal(reveal.sender,card.sender);assert.equal(reveal.message,card.message)
  assert(calls>=2)
  refunded=true
  assert.equal((await PUT(request('PUT'))).status,404)
  refunded=false;free=true
  assert.equal((await POST(request('POST'))).status,200)
  const freeSealed=await POST(request('POST'))
  assert.equal(freeSealed.status,200)
  const freePreview=(await freeSealed.json()).card
  assert.equal(freePreview.sender,null)
  assert.equal(Object.hasOwn(freePreview,'message'),false)
  const freeOpened=await PUT(request('PUT'))
  assert.equal(freeOpened.status,200)
  assert.equal((await freeOpened.json()).card.message,card.message)
  revoked=true
  assert.equal((await POST(request('POST'))).status,404)
  assert.equal((await PUT(request('PUT'))).status,404)
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env)}
})
