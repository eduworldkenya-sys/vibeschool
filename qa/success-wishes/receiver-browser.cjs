'use strict'
// Controlled mock-provider browser journey: no real customers, SMS or money.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const PORT = 3093
const ROOT = 'http://localhost:' + PORT
const CARD_A = '11111111-1111-4111-8111-111111111111'
const CARD_B = '22222222-2222-4222-8222-222222222222'
const CHALLENGE = '33333333-3333-4333-8333-333333333333'
const serverLog = fs.openSync(path.join(os.tmpdir(),'success-wishes-receiver-browser.log'),'w')
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port',String(PORT)],{
  env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false',
    SUCCESS_WISHES_RECEIVER_ENABLED:'false'},
  stdio:['ignore',serverLog,serverLog],
})
let browser
async function ready() {
  for(let n=0;n<90;n++){
    if(server.exitCode!==null)throw Error('Test server stopped unexpectedly')
    try { const r=await fetch(ROOT+'/api/success-wishes/config');if(r.ok)return }catch{}
    await new Promise(resolve=>setTimeout(resolve,1000))
  }
  throw Error('Receiver test server did not start')
}
function setupMocks(page) {
  const state={verified:false,opened:false,verifiedCalls:0,wrongCardReveals:0}
  const card=(id)=>({id,candidate:'Synthetic Candidate',school:'Synthetic School',examYear:'2026',
    theme:id===CARD_A?'heritage':'nightfall',sender:id===CARD_A?null:'Aunt',
    opened:id===CARD_B,consentRequired:id===CARD_A&&!state.verified,createdAt:'2026-10-26T08:00:00.000Z'})
  page.route('**/api/success-wishes/receiver/**',async route=>{
    const request=route.request();const url=new URL(request.url());const method=request.method()
    const data=['POST','PUT','PATCH'].includes(method)?request.postDataJSON()||{}:{}
    let status=200, payload={}
    if(url.pathname.endsWith('/card')){
      if(method==='POST'){
        if(!data.token || data.token!=='a'.repeat(64)){
          status=404;payload={error:'This card link or access code is invalid.'}
        }else payload={card:card(CARD_A)}
      }else if(method==='GET')payload={card:card(url.searchParams.get('card')||CARD_A)}
      else if(method==='PUT'){
        if(data.cardId!==CARD_A && data.cardId!==CARD_B){
          state.wrongCardReveals++;status=409;payload={error:'Another private card is active.'}
        }else if(!state.verified && data.cardId===CARD_A){
          status=403;payload={error:'Consent must be verified.'}
        }else{
          state.opened=true
          payload={card:{...card(data.cardId),consentRequired:false,opened:true,
            sender:data.cardId===CARD_A?'Mum':'Aunt',message:'You are capable of wonderful things.'}}
        }
      }else payload={ok:true}
    } else if(url.pathname.endsWith('/verify')){
      if(method==='POST')payload={challengeId:CHALLENGE,consentRole:'guardian',expiresInSeconds:300}
      else if(method==='PATCH'){
        state.verifiedCalls++
        if(data.cardId!==CARD_A || data.code!=='123456' || !data.consentAcknowledged || data.consentRole!=='guardian'){
          status=401;payload={error:'Guardian approval missing.'}
        }else{state.verified=true;payload={ok:true,recoveryCode:'B'.repeat(32),inboxUrl:'/success-wishes/inbox'}}
      }
    } else if(url.pathname.endsWith('/inbox')){
      if(method==='GET')payload={recipient:{name:'Synthetic Candidate',school:'Synthetic School'},
        count:2,unopened:1,cards:[
          {id:CARD_A,theme:'heritage',sender:state.opened?'Mum':null,opened:state.opened,createdAt:'2026-10-26T08:00:00.000Z'},
          {id:CARD_B,theme:'nightfall',sender:'Aunt',opened:true,createdAt:'2026-10-25T08:00:00.000Z'},
        ]}
      else if(method==='POST')payload={ok:true,url:'/success-wishes/invitation?card='+data.cardId}
      else payload={ok:true}
    } else if(url.pathname.endsWith('/recover')){
      if(method==='POST')payload={challengeId:CHALLENGE,expiresInSeconds:300}
      else if(method==='PATCH')payload=data.code==='123456'?{ok:true,inboxUrl:'/success-wishes/inbox'}:{error:'Invalid code'}
    } else {status=404;payload={error:'Unknown controlled route'}}
    await route.fulfill({status:status===200?200:status,contentType:'application/json',
      headers:{'Cache-Control':'no-store'},body:JSON.stringify(payload)})
  })
  return state
}
async function assertNoOverflow(page,label){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,
    label+' must not overflow horizontally')
}
async function run() {
  await ready()
  browser=await chromium.launch({headless:true})
  for(const width of [320,390,768,1280]){
    const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'})
    const page=await ctx.newPage();page.setDefaultTimeout(20000)
    const state=setupMocks(page)
    await page.goto(ROOT+'/success-wishes/invitation#token='+'a'.repeat(64),{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Your private invitation'}).waitFor()
    await page.getByRole('heading',{name:'Your private card is sealed'}).waitFor()
    assert(!page.url().includes('#token='),'Access secret must leave browser address after accepted claim')
    assert.match(page.url(),/\?card=11111111/)
    assert.equal(await page.getByRole('button',{name:/Open the envelope/}).count(),0,
      'Pending consent cannot interactively reveal the envelope')
    await assertNoOverflow(page,'sealed card at '+width)
    await page.getByRole('link',{name:'Verify to open this card'}).click()
    await page.getByRole('button',{name:'Send verification SMS'}).click()
    await page.getByRole('text', {name:/The parent or guardian must check/}).waitFor().catch(()=>{})
    await page.getByRole('textbox',{name:'SMS verification code'}).fill('123456')
    await page.getByRole('checkbox').check()
    await page.getByRole('button',{name:'Verify and open inbox'}).click()
    await page.getByRole('heading',{name:'Your private inbox is ready'}).waitFor()
    assert.equal(state.verified,true,'Guardian approval must be completed')
    await assertNoOverflow(page,'guardian verification at '+width)
    await page.getByRole('link',{name:'Open My Success Wishes'}).click()
    await page.getByRole('heading',{name:'My Success Wishes'}).waitFor()
    assert.equal(await page.locator('button[aria-label^="Open"]').count(),2,'Two gifts share one inbox')
    await assertNoOverflow(page,'two-gift inbox at '+width)
    const gifts=page.locator('button[aria-label^="Open"]')
    await gifts.first().click()
    await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).click()
    await page.getByText('You are capable of wonderful things.').first().waitFor({state:'visible'})
    assert.equal(state.opened,true,'Paid reveal endpoint was called')
    assert.equal(state.wrongCardReveals,0,'Card ID must stay pinned')
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).waitFor()
    await assertNoOverflow(page,'refreshed gift at '+width)
    await page.goto(ROOT+'/success-wishes/recover',{waitUntil:'networkidle'})
    await page.getByRole('textbox',{name:'Registered Kenyan phone number'}).fill('0712345678')
    await page.getByRole('textbox',{name:'Student recovery code'}).fill('B'.repeat(32))
    await page.getByRole('button',{name:'Send verification SMS'}).click()
    await page.getByRole('textbox',{name:'SMS verification code'}).fill('123456')
    await page.getByRole('button',{name:'Open My Success Wishes'}).click()
    await page.getByRole('heading',{name:'My Success Wishes'}).waitFor()
    await assertNoOverflow(page,'recovered inbox at '+width)
    console.log('Receiver controlled browser pass:',width)
    await ctx.close()
  }
}
run().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
  await browser?.close()
  server.kill('SIGTERM')
  fs.closeSync(serverLog)
})
