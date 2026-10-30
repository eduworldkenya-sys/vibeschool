import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {PUT} from '../../app/api/success-wishes/gift/route'
import {GET,POST} from '../../app/api/success-wishes/receiver/remembered/route'
import {DELETE} from '../../app/api/success-wishes/receiver/account/route'
import {browserHash,GIFT_COOKIE} from './remembered-gifts'
import {hashSecret} from './security'
const base='https://wishes.example',token='a'.repeat(64),browser='b'.repeat(64),id='11111111-1111-4111-8111-111111111111'
const make=(method:string,path:string,body:unknown=null,cookie='')=>new NextRequest(base+'/api/success-wishes/'+path,{method,headers:{origin:base,'content-type':'application/json',...(cookie?{cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})})
test('gift device sessions remember only opened capabilities; no number discovery, sibling access, PIN grant, stale payment or refund bypass',async()=>{
 const env={...process.env},original=fetch
 const sessions:Array<Record<string,unknown>>=[]
 let refunded=false,revoked=false,consentRevoked=false
 const card={kind:'success_wish_text',candidate:'Joe',sender:'Mum',message:'Private Joe message',examYear:'2026',school:'Gilgil Township',theme:'heritage'}
 const gift=()=>({id,delivery_receiver_id:'22222222-2222-4222-8222-222222222222',item_index:null,link_hash:hashSecret('success-wishes:paid-link:'+token),expires_at:new Date(Date.now()+86400000).toISOString(),revoked_at:revoked?'now':null,success_wish_guest_orders:{id:'order',state:'settled',card,amount_kes:50,provider_receipt:'SYNTHETIC',provider_verified_at:new Date().toISOString(),settled_at:new Date().toISOString(),refunded_at:refunded?'now':null,receiver_id:null}})
 globalThis.fetch=(async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),table=u.pathname.split('/').at(-1),method=init?.method||'GET'
  assert.equal(u.hostname,'synthetic.supabase.co')
  if(table==='success_wishes_take_attempt'||table==='success_wish_pin_open_gift')return Response.json(true)
  if(table==='success_wish_receiver_sessions'){
   if(method==='POST'){const row=JSON.parse(String(init?.body));assert.equal(row.receiver_id,null);assert.equal(row.pin_epoch,undefined);assert.equal(row.guest_gift_id,id);assert.equal(row.free_gift_id,null);assert.equal(row.guest_browser_hash,browserHash(browser));sessions.splice(0,sessions.length,row);return new Response(null,{status:201})}
   if(method==='DELETE'){assert.equal(u.searchParams.get('guest_browser_hash'),'eq.'+browserHash(browser));sessions.length=0;return new Response(null,{status:204})}
   assert.equal(u.searchParams.get('guest_browser_hash'),'eq.'+browserHash(browser));return Response.json(sessions)
  }
  if(table==='success_wish_guest_gifts'){if(u.searchParams.has('id'))assert.equal(u.searchParams.get('id'),'eq.'+id);return Response.json(revoked?null:gift())}
  if(table==='success_wish_receivers')return Response.json({consent_status:consentRevoked?'revoked':'pending'})
  if(table==='success_wish_free_gifts')return Response.json(null)
  throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 try{
  Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-pepper-at-least-32-chars'})
  assert.deepEqual((await (await GET(make('GET','receiver/remembered'))).json()).cards,[])
  const cookie=GIFT_COOKIE+'='+browser
  assert.equal((await POST(make('POST','receiver/remembered',{id,reveal:true},cookie))).status,404)
  const opened=await PUT(make('PUT','gift',{token},cookie));assert.equal(opened.status,200);assert.equal((await opened.json()).card.message,card.message)
  const set=opened.headers.get('set-cookie')||'';assert.match(set,/HttpOnly/);assert.match(set,/Secure/);assert.match(set,/SameSite=strict/i)
  assert.equal(sessions.length,1)
  const remembered=await GET(make('GET','receiver/remembered',null,cookie));assert.equal(remembered.status,200);const list=(await remembered.json()).cards;assert.equal(list.length,1);assert.equal(list[0].candidate,'Joe');assert.equal(list[0].message,undefined)
  assert.equal((await POST(make('POST','receiver/remembered',{id:'33333333-3333-4333-8333-333333333333',reveal:true},cookie))).status,404)
  assert.equal((await POST(make('POST','receiver/remembered',{id,reveal:true},cookie))).status,200)
  refunded=true;assert.equal((await POST(make('POST','receiver/remembered',{id,reveal:true},cookie))).status,404);assert.deepEqual((await (await GET(make('GET','receiver/remembered',null,cookie))).json()).cards,[])
  refunded=false;consentRevoked=true;assert.equal((await POST(make('POST','receiver/remembered',{id,reveal:true},cookie))).status,404);consentRevoked=false;revoked=true;assert.equal((await POST(make('POST','receiver/remembered',{id,reveal:true},cookie))).status,404)
  assert.equal((await DELETE(make('DELETE','receiver/account',{},cookie))).status,200);assert.equal(sessions.length,0)
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env)}
})
