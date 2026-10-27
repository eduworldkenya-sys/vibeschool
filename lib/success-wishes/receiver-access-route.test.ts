import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../app/api/success-wishes/receiver/card/route'
import { DELETE as logoutInbox } from '../../app/api/success-wishes/receiver/inbox/route'
import { enrolRecovery, inboxDigest } from './receiver-otp'
import { receiverDatabase, sessionDigest } from './receiver'
const origin='https://receiver.example',cardId='11111111-1111-4111-8111-111111111111'
const receiverId='22222222-2222-4222-8222-222222222222',otherId='33333333-3333-4333-8333-333333333333'
const cardToken='a'.repeat(64),inboxToken='b'.repeat(64),future=new Date(Date.now()+86400000).toISOString()
type Row=Record<string,unknown>
/** Actual Next handlers/Supabase client; only PostgREST transport is stubbed.
 * SQL/role semantics are covered separately by disposable PostgreSQL tests. */
test('enabled receiver denies copied links and cross-recipient sessions; preserves recovery and fully revokes device sessions',async()=>{
 const saved={...process.env},original=globalThis.fetch
 const rows:Record<string,Row[]>={
  success_wish_card_sessions:[{token_hash:sessionDigest(cardToken),card_id:cardId,expires_at:future}],
  success_wish_receiver_sessions:[{token_hash:inboxDigest(inboxToken),receiver_id:receiverId,expires_at:future}],
  success_wish_card_access:[{card_id:cardId,revoked_at:null,expires_at:future}],
  success_wish_cards:[{id:cardId,receiver_id:receiverId,payment_attempt_id:'payment',theme:'heritage',sender_name:'Synthetic Mum',sender_reveal_early:false,message:'Exact saved synthetic wish',exam_year:'2026',opened_at:null,revoked_at:null,expires_at:future,created_at:future}],
  success_wish_receivers:[{id:receiverId,display_name:'Synthetic learner',school_label:'Synthetic school',consent_status:'verified',phone_e164:'+254712000111',recovery_secret_hash:'c'.repeat(64)}],
  commerce_payment_attempts:[{id:'payment',provider:'mpesa',state:'settled',provider_receipt:'SYNTHETIC',provider_result_code:0,settled_at:future,callback_received_at:future,order_id:'order',expected_amount_kes:50}],
  learning_product_orders:[{id:'order',status:'paid',refunded_at:null,amount_kes:50,product_snapshot:{kind:'success_wish_text'}}],
 }
 let failDelete=false
 const deletions:string[]=[]
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  assert.equal(url.hostname,'synthetic.supabase.co','No real network permitted')
  const table=url.pathname.split('/').at(-1)!,method=init?.method||'GET'
  const matches=(row:Row)=>[...url.searchParams].every(([key,condition])=>{
   if(['select','limit','order'].includes(key))return true
   if(condition==='is.null')return row[key]==null
   if(condition.startsWith('eq.'))return String(row[key])===condition.slice(3)
   throw Error('Unexpected fixture condition '+condition)
  })
  const found=(rows[table]||[]).filter(matches)
  if(method==='DELETE'){
   deletions.push(table)
   if(failDelete)return Response.json({message:'Synthetic database outage'},{status:503})
   rows[table]=(rows[table]||[]).filter(row=>!matches(row));return new Response(null,{status:204})
  }
  if(method==='PATCH')found.forEach(row=>Object.assign(row,JSON.parse(String(init?.body))))
  const single=String(new Headers(init?.headers).get('accept')).includes('vnd.pgrst.object')
  return Response.json(single?(found[0]||null):found)
 }) as typeof fetch
 const request=(method:string,both=false)=>new NextRequest(origin+'/api/success-wishes/receiver/card?card='+cardId,{
  method,headers:{origin,'content-type':'application/json',cookie:`vs_wish_card=${cardToken}`+(both?`; vs_wishes_receiver=${inboxToken}`:'')},
  ...(method==='PUT'?{body:JSON.stringify({cardId})}:{}),
 })
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',SUCCESS_WISHES_RECEIVER_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-only',SUCCESS_WISHES_VERIFICATION_SECRET:'synthetic-verification-'.repeat(3)})
  const envelope=await GET(request('GET'));assert.equal(envelope.status,200)
  const sealed=(await envelope.json()).card
  assert.equal(sealed.consentRequired,true);assert.equal(sealed.sender,null);assert.equal(sealed.message,undefined)
  assert.equal((await PUT(request('PUT'))).status,401)
  rows.success_wish_receiver_sessions[0].receiver_id=otherId
  rows.success_wish_receivers.push({...rows.success_wish_receivers[0],id:otherId})
  assert.equal((await PUT(request('PUT',true))).status,403)
  rows.success_wish_receiver_sessions[0].receiver_id=receiverId
  const opened=await PUT(request('PUT',true));assert.equal(opened.status,200)
  assert.equal((await opened.json()).card.message,'Exact saved synthetic wish')
  assert.equal(await enrolRecovery(receiverDatabase(),receiverId),null)
  assert.equal(rows.success_wish_receivers[0].recovery_secret_hash,'c'.repeat(64))
  assert.match((await enrolRecovery(receiverDatabase(),receiverId,true))!,/^[0-9A-F]{32}$/)
  assert.notEqual(rows.success_wish_receivers[0].recovery_secret_hash,'c'.repeat(64))
  rows.success_wish_card_access[0].revoked_at=future
  assert.equal((await GET(request('GET',true))).status,401)
  process.env.SUCCESS_WISHES_ENABLED='false';process.env.SUCCESS_WISHES_STAFF_SETUP_ENABLED='false'
  for(const handler of [DELETE,logoutInbox]){
   const response=await handler(request('DELETE',true));assert.equal(response.status,200)
   assert.equal(response.cookies.get('vs_wish_card')?.value,'');assert.equal(response.cookies.get('vs_wishes_receiver')?.value,'')
  }
  assert(deletions.includes('success_wish_card_sessions'));assert(deletions.includes('success_wish_receiver_sessions'))
  failDelete=true
  const failure=await DELETE(request('DELETE',true));assert.equal(failure.status,503)
  assert.equal(failure.cookies.get('vs_wish_card')?.value,'');assert.equal(failure.cookies.get('vs_wishes_receiver')?.value,'')
  const hostile=await DELETE(new NextRequest(origin+'/api/success-wishes/receiver/card',{method:'DELETE',headers:{origin:'https://other.example'}}))
  assert.equal(hostile.status,403);assert.equal(hostile.cookies.getAll().length,0)
 }finally{globalThis.fetch=original;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}
})
