import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST,GET,DELETE} from '../../app/api/success-wishes/receiver/account/route'
import {POST as createRequest} from '../../app/api/success-wishes/receiver/request/route'
import {POST as readGift} from '../../app/api/success-wishes/receiver/collection/route'
import {PIN_COOKIE,protectPin} from './receiver-pin'
import {sessionHash} from './receiver-collection'
const origin='https://vibeschool.example',id='11111111-1111-4111-8111-111111111111',secret='a'.repeat(64)
const request=(body:unknown,cookie='',method='POST')=>new NextRequest(origin+'/api/success-wishes/receiver/account',{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})})
test('no-SMS PIN access enforces attempts, ownership, revocation, epoch reset and secure cookies',async()=>{
 const old={...process.env},oldFetch=fetch;let attempts=0,session=false,epoch=1,revoked=false,reset=false
 Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-pepper-at-least-32-chars'})
 const person={id,display_name:'Charles',school_label:'',phone_e164:'+254733000111',pin_epoch:1,pin_exam_year:'2026',pin_hash:protectPin('0123'),consent_status:'pending'}
 globalThis.fetch=(async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),table=u.pathname.split('/').at(-1),method=init?.method||'GET';assert.equal(u.hostname,'synthetic.supabase.co')
 if(table==='success_wishes_take_attempt'){attempts++;return Response.json(true)}
 if(table==='success_wish_receivers'){assert.equal(u.searchParams.get('id'),'eq.'+id);return Response.json({...person,pin_epoch:epoch,consent_status:revoked?'revoked':'pending'})}
 if(table==='success_wish_receiver_sessions'){if(method==='POST'){session=true;return Response.json(null,{status:201})}if(method==='DELETE'){session=false;return new Response(null,{status:204})}assert.equal(u.searchParams.get('token_hash'),'eq.'+sessionHash(secret));return Response.json(session?{receiver_id:id,pin_epoch:1,expires_at:new Date(Date.now()+86400000).toISOString()}:null)}
 if(table==='success_wish_guest_orders'){assert.equal(u.searchParams.get('inbox_receiver_id'),'eq.'+id);return Response.json(null)}
 if(table==='success_wish_pin_recover'){if(reset)return Response.json([]);reset=true;epoch++;return Response.json([{id,pin_epoch:epoch}])}
 throw Error('Unexpected transport '+u.pathname)
 }) as typeof fetch
 try{
 assert.equal((await POST(request({action:'login',inboxId:id,pin:'9999'}))).status,401)
 const login=await POST(request({action:'login',inboxId:id,pin:'0123'}));assert.equal(login.status,200);assert.match(login.headers.get('set-cookie')||'',/HttpOnly/);assert.match(login.headers.get('set-cookie')||'',/Max-Age=7776000/);assert(attempts>=6)
 const cookie=PIN_COOKIE+'='+secret;assert.equal((await GET(request(null,cookie,'GET'))).status,200)
 assert.equal((await readGift(request({id:'22222222-2222-4222-8222-222222222222',source:'paid',reveal:true},cookie))).status,404)
 revoked=true;assert.equal((await GET(request(null,cookie,'GET'))).status,401);revoked=false
 assert.equal((await POST(request({action:'attach',token:secret,inboxId:'22222222-2222-4222-8222-222222222222'},cookie))).status,409,'Switching learners cannot claim a gift for the wrong inbox')
 assert.equal((await createRequest(request({phone:'0733000222',inboxId:'22222222-2222-4222-8222-222222222222'},cookie))).status,409,'Switching learners cannot create a request for the wrong inbox')
 assert.equal((await POST(request({action:'recover',recovery:secret,setupKey:'b'.repeat(64),pin:'4567'}))).status,200)
 assert.equal((await GET(request(null,cookie,'GET'))).status,401)
 assert.equal((await POST(request({action:'recover',recovery:secret,setupKey:'c'.repeat(64),pin:'4567'}))).status,401)
 assert.equal((await DELETE(request({},cookie,'DELETE'))).status,200)
 const cross=request({action:'login',inboxId:id,pin:'0123'});cross.headers.set('origin','https://evil.example');assert.equal((await POST(cross)).status,403)
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old)}
})
test('lock revokes PIN, legacy inbox and card capabilities even while public access is off',async()=>{
 const old={...process.env},oldFetch=fetch,removed:string[]=[]
 Object.assign(process.env,{SUCCESS_WISHES_ENABLED:'false',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-pepper-at-least-32-chars'})
 globalThis.fetch=(async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(init?.method,'DELETE');removed.push(u.pathname+':'+u.searchParams.get('token_hash'));return new Response(null,{status:204})}) as typeof fetch
 try{const r=await DELETE(request({},PIN_COOKIE+'='+secret+'; vs_wishes_receiver='+'b'.repeat(64)+'; vs_wish_card='+'c'.repeat(64),'DELETE'));assert.equal(r.status,200);assert.equal(removed.length,3);const cookies=r.headers.get('set-cookie')||'';for(const key of [PIN_COOKIE,'vs_wishes_receiver','vs_wish_card'])assert(cookies.includes(key+'='));assert(removed.some(v=>v.endsWith('eq.'+sessionHash(secret))))}finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old)}
})
