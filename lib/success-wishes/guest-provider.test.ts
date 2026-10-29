import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
type Row=Record<string,unknown>
function fixture(name:string,row:Row,claim=true,result:Row={},probe:unknown=[],probeStatus=200,transportFailure=false,envOverrides:Record<string,string>={}){
 let handler:(r:Request)=>Promise<Response>
 let claimCount=0
 const updates:Row[]=[],calls:string[]=[],requests:{url:string;authorization:string|null;body:unknown}[]=[]
 const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-secret',MPESA_ENV:'production',MPESA_SHORTCODE:'961580',MPESA_PARTY_B:'949529',MPESA_TRANSACTION_TYPE:'CustomerBuyGoodsOnline',MPESA_CONSUMER_KEY:'key',MPESA_CONSUMER_SECRET:'secret',MPESA_PASSKEY:'passkey'}
 Object.assign(env,envOverrides)
 const db={rpc:async()=>{claimCount++;return {data:claim,error:null}},from:()=>{
  let patch:Row|undefined,states:string[]|undefined,matched=true
  const chain={select:()=>chain,eq:(k:string,v:unknown)=>{if(row[k]!==v)matched=false;return chain},is:(k:string,v:unknown)=>{if((row[k]??null)!==v)matched=false;return chain},in:(_k:string,v:string[])=>{states=v;return chain},update:(p:Row)=>{patch=p;return chain},single:async()=>({data:matched?row:null,error:null}),maybeSingle:async()=>({data:matched?row:null,error:null}),then:(resolve:(v:unknown)=>unknown)=>{if(matched&&patch&&(!states||states.includes(row.state as string))){updates.push(patch);Object.assign(row,patch)}return Promise.resolve({error:null}).then(resolve)}}
  return chain
 }}
 const source=readFileSync(new URL('../../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8').replace(/import \{createClient\} from 'npm:[^']+'/,'')
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 const fetcher=async(url:string,options?:RequestInit)=>{calls.push(url);requests.push({url,authorization:new Headers(options?.headers).get('authorization'),body:options?.body?JSON.parse(String(options.body)):null});if(transportFailure)throw Error('Synthetic transport failure');if(url.includes('/rest/v1/'))return new Response(JSON.stringify(probe),{status:probeStatus});return new Response(JSON.stringify(url.includes('/oauth/')?{access_token:'test-access-token'}:result),{status:200})}
 new Function('Deno','createClient','fetch','crypto',js)({env:{get:(k:string)=>env[k]},serve:(f:typeof handler)=>{handler=f}},()=>db,fetcher,crypto)
 return {handle:(r:Request)=>handler(r),updates,calls,requests,get claimCount(){return claimCount}}
}
const id='33333333-3333-4333-8333-333333333333'
const req=(action:string,auth='server-secret',merchant?:unknown)=>new Request('https://example.supabase.co/functions/v1/success-wishes-checkout',{method:'POST',headers:{authorization:'Bearer '+auth},body:JSON.stringify({action,id,...(merchant!==undefined?{merchant}:{})})})
const query={ResponseCode:'0',ResultCode:'0',CheckoutRequestID:'CHECKOUT1',MerchantRequestID:'MERCHANT1'}
const pending=()=>({id,amount_kes:50,state:'awaiting_customer',payer_phone:'254712345678',checkout_id:'CHECKOUT1',merchant_id:'MERCHANT1',updated_at:'2020-01-01',callback_event:{resultCode:0,amount:50,phone:254712345678,receipt:'QAONLY123',checkout:'CHECKOUT1',merchant:'MERCHANT1'}})
test('browser credentials and unclaimed orders cannot call Safaricom',async()=>{
 const f=fixture('success-wishes-checkout',{id,state:'created'},false)
 assert.equal((await f.handle(req('pay','user-token'))).status,401);assert.equal((await f.handle(req('pay'))).status,409);assert.equal(f.calls.filter(c=>c.includes('processrequest')).length,0)
})
test('forged callback amounts phones receipts and checkout references cannot settle',async()=>{
 for(const edit of [{amount:1},{phone:254700000000},{receipt:'bad receipt'},{checkout:'foreign'}]){const row=pending();Object.assign(row.callback_event,edit);const f=fixture('success-wishes-checkout',row,true,query);await f.handle(req('reconcile'));assert.notEqual(row.state,'settled')}
})
test('matching callback plus independent provider query settles exactly once',async()=>{
 const row=pending(),f=fixture('success-wishes-checkout',row,true,query)
 assert.equal((await f.handle(req('reconcile'))).status,200);assert.equal(row.state,'settled');await f.handle(req('reconcile'));assert.equal(f.updates.filter(u=>u.state==='settled').length,1)
 assert.deepEqual(f.updates[0].provider_query,query)
 const missing:Row={...pending(),callback_event:null},g=fixture('success-wishes-checkout',missing,true,query);await g.handle(req('reconcile'));assert.equal(missing.state,'awaiting_customer');assert.equal(g.calls.length,0)
})
test('ambiguous STK reply cannot issue a card or trigger an automatic second prompt',async()=>{
 const row={id,state:'submitting',payer_phone:'254712345678',amount_kes:50},f=fixture('success-wishes-checkout',row,true,{unexpected:true})
 await f.handle(req('pay'));assert.equal(row.state,'reconciliation_required');assert.equal(f.calls.filter(c=>c.includes('processrequest')).length,1)
})
test('callback capability is required and callback stores evidence without settlement',async()=>{
 const token='a'.repeat(64),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('')
 const row:Row={id,state:'awaiting_customer',callback_hash:digest,checkout_id:'CHECKOUT1',merchant_id:'MERCHANT1',callback_event:null},f=fixture('success-wishes-mpesa-callback',row)
 const body={Body:{stkCallback:{CheckoutRequestID:'CHECKOUT1',MerchantRequestID:'MERCHANT1',ResultCode:0,CallbackMetadata:{Item:[{Name:'Amount',Value:50},{Name:'PhoneNumber',Value:254712345678},{Name:'MpesaReceiptNumber',Value:'QAONLY123'}]}}}}
 const request=(secret:string)=>new Request('https://example.supabase.co/functions/v1/success-wishes-mpesa-callback?id='+id+'&token='+secret,{method:'POST',body:JSON.stringify(body)})
 assert.equal((await f.handle(request('b'.repeat(64)))).status,403);assert.equal(f.updates.length,0)
 assert.equal((await f.handle(request(token))).status,200);assert.equal(row.state,'awaiting_customer');assert.ok(row.callback_event);assert.equal(f.calls.length,0)
 const first=JSON.stringify(row.callback_event);await f.handle(request(token));assert.equal(JSON.stringify(row.callback_event),first);assert.equal(f.updates.length,1)
})

test('rotated service credentials require a successful protected same-project Data API read',async()=>{
 const f=fixture('success-wishes-checkout',{id,state:'created'},false,{},[{singleton:true}])
 const response=await f.handle(req('pay','rotated.service.jwt'))
 assert.equal(response.status,409,'Authenticated but unclaimed; no payment')
 assert.equal(f.calls.filter(c=>c.includes('/rest/v1/')).length,1)
 assert.equal(f.calls.filter(c=>c.includes('processrequest')).length,0)
 assert.equal(f.calls[0],'https://example.supabase.co/rest/v1/mpesa_runtime_control?select=singleton&singleton=eq.true')
})
test('invalid, forged, expired and user credentials cannot reach payment claims',async()=>{
 for(const [probe,status] of [[[],200],[[{singleton:false}],200],[[{singleton:true},{singleton:true}],200],[{},200],[[{singleton:true}],403],[[{singleton:true}],401]] as const){
  const f=fixture('success-wishes-checkout',{id,state:'created'},true,{},probe,status)
  assert.equal((await f.handle(req('pay','forged.service.payload'))).status,401)
  assert.equal(f.updates.length,0);assert.equal(f.calls.filter(c=>c.includes('safaricom')).length,0)
 }
 const f=fixture('success-wishes-checkout',{id,state:'created'},true,{},[{singleton:true}])
 const mixed=new Request('https://example.supabase.co',{method:'POST',headers:{authorization:'Bearer browser-user',apikey:'server-secret'},body:JSON.stringify({action:'pay',id})})
 assert.equal((await f.handle(mixed)).status,401);assert.equal(f.calls.length,0)
})
test('readiness authenticates with Safaricom OAuth but never sends an STK or claims an order',async()=>{
 const f=fixture('success-wishes-checkout',{id,state:'created'})
 assert.equal((await f.handle(req('health'))).status,200)
 assert.equal(f.calls.length,1);assert.match(f.calls[0],/oauth\/v1\/generate/);assert.equal(f.updates.length,0)
})

test('auth probe network failure fails closed and missing provider config never claims',async()=>{
 const denied=fixture('success-wishes-checkout',{id,state:'created'},true,{},[{singleton:true}],200,true)
 assert.equal((await denied.handle(req('pay','rotated.service.jwt'))).status,401)
 assert.equal(denied.updates.length,0)
 const missing=fixture('success-wishes-checkout',{id,state:'created'},true,{},[],200,false,{MPESA_PASSKEY:''})
 assert.equal((await missing.handle(req('health'))).status,503)
 assert.equal(missing.calls.length,0);assert.equal(missing.updates.length,0)
 const oauth=fixture('success-wishes-checkout',{id,state:'created'},true,{},[],200,true)
 assert.equal((await oauth.handle(req('pay'))).status,503)
 assert.equal(oauth.updates.length,0);assert.equal(oauth.claimCount,0);assert.equal(oauth.calls.filter(c=>c.includes('processrequest')).length,0)
})

const dedicatedMerchant=()=>({environment:'production',shortcode:'961580',partyB:'949529',transactionType:'CustomerBuyGoodsOnline',consumerKey:'wish-key',consumerSecret:'wish-secret',passkey:'wish-passkey'})
test('dedicated merchant configuration ignores unrelated shared sandbox routing',async()=>{
 const f=fixture('success-wishes-checkout',{id,state:'created'},false,{},[],200,false,{MPESA_ENV:'sandbox',MPESA_SHORTCODE:'174379'})
 assert.equal((await f.handle(req('health','server-secret',dedicatedMerchant()))).status,200)
 assert.equal(f.requests[0].authorization,'Basic '+btoa('wish-key:wish-secret'))
 assert.equal(f.calls.filter(c=>c.includes('processrequest')).length,0);assert.equal(f.updates.length,0)
})
test('invalid supplied merchant cannot downgrade to valid shared configuration or reach provider',async()=>{
 for(const merchant of [null,{},[],{...dedicatedMerchant(),partyB:'another-till'},{...dedicatedMerchant(),environment:'sandbox'},{...dedicatedMerchant(),passkey:''},{...dedicatedMerchant(),consumerKey:'x'.repeat(2049)}]){
  const f=fixture('success-wishes-checkout',{id,state:'created'})
  assert.equal((await f.handle(req('pay','server-secret',merchant))).status,503)
  assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);assert.equal(f.claimCount,0)
 }
 const denied=fixture('success-wishes-checkout',{id,state:'created'})
 assert.equal((await denied.handle(req('pay','user-token',dedicatedMerchant()))).status,401)
 assert.equal(denied.calls.length,0);assert.equal(denied.updates.length,0);assert.equal(denied.claimCount,0)
})
test('concurrent health requests keep each service-provided credential isolated',async()=>{
 const f=fixture('success-wishes-checkout',{id,state:'created'})
 const first=dedicatedMerchant(),second={...dedicatedMerchant(),consumerKey:'second-key',consumerSecret:'second-secret'}
 const responses=await Promise.all([f.handle(req('health','server-secret',first)),f.handle(req('health','server-secret',second))])
 assert.deepEqual(responses.map(r=>r.status),[200,200])
 assert.deepEqual(f.requests.map(r=>r.authorization).sort(),['Basic '+btoa('wish-key:wish-secret'),'Basic '+btoa('second-key:second-secret')].sort())
 assert.equal(f.updates.length,0)
 for(const response of responses)assert.deepEqual(await response.json(),{ready:true},'Credentials never appear in health responses')
})

test('group STK uses the stored KSh 100 and a KSh 50 callback cannot settle it',async()=>{
 const row={id,state:'submitting',payer_phone:'254712345678',amount_kes:100}
 const f=fixture('success-wishes-checkout',row,true,{ResponseCode:'0',CheckoutRequestID:'CHECKOUT1',MerchantRequestID:'MERCHANT1'})
 assert.equal((await f.handle(req('pay'))).status,200)
 const stk=f.requests.find(r=>r.url.includes('processrequest'))!.body as Row
 assert.equal(stk.Amount,100)
 const pendingGroup={...pending(),amount_kes:100}
 const wrong=fixture('success-wishes-checkout',pendingGroup,true,query)
 await wrong.handle(req('reconcile'));assert.notEqual(pendingGroup.state,'settled')
 pendingGroup.callback_event.amount=100
 pendingGroup.updated_at='2020-01-01'
 await wrong.handle(req('reconcile'));assert.equal(pendingGroup.state,'settled')
})
