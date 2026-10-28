import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/success-wishes/free/route'
const url='https://vibeschool.example/api/success-wishes/free'
const key='a'.repeat(64)
const make=(extra:Record<string,unknown>={})=>new NextRequest(url,{method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},body:JSON.stringify({key,version:'text',theme:'heritage',candidate:'Learner',sender:'Friend',message:'Good luck',examYear:'2026',...extra})})
test('free wishes require server-side pilot authority and never initiate payment',async()=>{
 const env={...process.env},oldFetch=globalThis.fetch
 let enabled=false,rpcs=0
 globalThis.fetch=(async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  const endpoint=u.pathname.split('/').at(-1)
  if(endpoint==='success_wishes_take_attempt')return Response.json(true)
  if(endpoint==='success_wishes_pilot_control')return Response.json({free_text_enabled:enabled})
  if(endpoint==='success_wish_issue_free_guest_gift'){
   rpcs++
   const body=JSON.parse(String(init?.body))
   assert.equal(body.p_card.kind,'success_wish_text')
   assert.equal(body.p_card.message,'Good luck')
   assert.match(body.p_link_hash,/^[a-f0-9]{64}$/)
   return Response.json('11111111-1111-4111-8111-111111111111')
  }
  throw Error('Unexpected transport: '+u.pathname)
 }) as typeof fetch
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})
  assert.equal((await POST(make())).status,503)
  assert.equal(rpcs,0)
  enabled=true
  assert.equal((await POST(make({paid:true}))).status,400)
  assert.equal((await POST(make({version:'voice'}))).status,400)
  assert.equal((await POST(make({message:'x'.repeat(221)}))).status,400)
  const sent=await POST(make())
  assert.equal(sent.status,200)
  const body=await sent.json()
  assert.equal(body.state,'free_issued');assert.equal(body.amountKes,0)
  assert.match(body.invitationUrl,/\/success-wishes\/gift#token=[a-f0-9]{64}$/)
  assert.equal(rpcs,1)
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env)}
})
