import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {GET} from '../../app/api/hq/success-wishes/ledger/route'
import {GET as schools} from '../../app/api/hq/success-wishes-schools/route'
const root='https://wishes.example/api/hq/success-wishes/ledger'
test('HQ traces gift, order, receipt, recipient and delivery address without private tokens and rejects non-operators',async()=>{
 const env={...process.env},original=fetch
 let operator=true
 const now=new Date().toISOString()
 globalThis.fetch=(async(input)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  assert.equal(u.hostname,'synthetic.supabase.co')
  if(u.pathname==='/auth/v1/user')return Response.json({id:'hq-human',aud:'authenticated',role:'authenticated'})
  const table=u.pathname.split('/').at(-1)
  if(table==='hq_human_members')return Response.json({status:'active',role:operator?'founder':'viewer',permissions:[]})
  if(!operator)throw Error('Non-operator read private ledger')
  if(table==='success_wish_guest_orders')return Response.json([{id:'order',amount_kes:50,state:'settled',created_at:now,settled_at:now,provider_verified_at:now,provider_receipt:'SYNTHETIC',card:{candidate:'Joe',sender:'Mum',deliveryPhone:'+254733000111'},success_wish_guest_gifts:[{id:'gift',delivery_receiver_id:'joe-id'}]}])
  if(table==='success_wish_guest_gifts'||table==='success_wish_free_gifts')return Response.json([])
  if(table==='success_wish_receivers')return Response.json([{id:'joe-id'}])
  throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 try{
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only'})
  assert.equal((await GET(new NextRequest(root))).status,401)
  assert.equal((await schools(new Request('https://wishes.example/api/hq/success-wishes-schools'))).status,403)
  const req=()=>new NextRequest(root,{headers:{authorization:'Bearer synthetic-token'}})
  const response=await GET(req());assert.equal(response.status,200)
  const p=await response.json();assert.equal(p.rows[0].id,'gift');assert.equal(p.rows[0].orderId,'order');assert.equal(p.rows[0].deliveryRecipientId,'joe-id');assert.equal(p.rows[0].deliveryAddress,'+254733000111');assert.equal(p.rows[0].receipt,'SYNTHETIC');assert.equal(p.rows[0].paid,true);assert.equal(p.rows[0].token,undefined)
  assert.equal((await schools(req())).status,200,'An authenticated active founder may read school aggregates')
  operator=false;assert.equal((await GET(req())).status,403)
  assert.equal((await schools(req())).status,403,'An authenticated non-founder cannot query school gift records')
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env)}
})
