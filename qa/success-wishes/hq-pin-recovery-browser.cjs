'use strict'
// Synthetic browser checks: no real HQ account, receiver, reset link or provider request.
const assert=require('node:assert/strict')
const {chromium}=require('playwright')
const {spawn}=require('node:child_process')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const ROOT='http://localhost:3098',ID1='a1111111-1111-4111-8111-111111111111',ID2='b2222222-2222-4222-8222-222222222222'
const REQUEST1='c3333333-3333-4333-8333-333333333333',REQUEST2='d4444444-4444-4444-8444-444444444444',REQUEST3='e5555555-5555-4555-8555-555555555555'
const now=new Date().toISOString()
const users={id:'f6666666-6666-4666-8666-666666666666',aud:'authenticated',role:'authenticated',email:'hq-synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:now}
const candidates=[
 {id:ID1,name:'Example Learner',school:'Example School',examYear:'2026',maskedPhone:'•••• 0111'},
 {id:ID2,name:'Example Learner',school:'Other School',examYear:'2026',maskedPhone:'•••• 0111'}
]
const requests=[
 {id:REQUEST1,status:'pending',exam_year:'2026',created_at:now,candidates:[candidates[0]]},
 {id:REQUEST2,status:'pending',exam_year:'2026',created_at:now,candidates},
 {id:REQUEST3,status:'pending',exam_year:'2026',created_at:now,candidates:[]}
]
const browserLog=fs.openSync(path.join(os.tmpdir(),'hq-pin-recovery-browser.log'),'w')
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3098'],{
 env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
 NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-synthetic-test-key',
 SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-service-key',SUCCESS_WISHES_ENABLED:'false',
 NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',browserLog,browserLog]
})
let browser
async function ready(){
 for(let n=0;n<100;n++){
  if(server.exitCode!==null)throw Error('Synthetic HQ server stopped before browser checks')
  try{if((await fetch(ROOT+'/api/success-wishes/config')).ok)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
 throw Error('Synthetic HQ browser server did not start')
}
async function install(page,sends){
 await page.addInitScript(({user,now})=>{
  const session={access_token:'synthetic-HQ-access-token',token_type:'bearer',expires_in:3600,
   expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'synthetic-HQ-refresh-token',user}
  localStorage.setItem('vibeschool-hq-auth',JSON.stringify(session))
 },{user:users,now})
 await page.route('https://example.supabase.co/**',route=>{
  const url=new URL(route.request().url())
  if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(users)})
  if(url.pathname.includes('/rpc/hq_check_owner_access'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({allowed:true})})
  if(url.pathname.includes('/rpc/hq_list_notifications'))return route.fulfill({status:200,contentType:'application/json',body:'[]'})
  return route.fulfill({status:200,contentType:'application/json',body:'{}'})
 })
 await page.route('**/api/hq/support/pin-recovery',async route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({requests})})
  const body=route.request().postDataJSON();sends.push(body)
  assert.equal(body.action,'approve')
  assert.equal(body.confirmedVerified,true,'HQ approval requires explicit confirmation')
  assert(body.evidence.length>=20,'HQ approval requires independent evidence')
  assert.equal(body.receiverId,ID2,'Choose the verified recipient when a request has multiple candidate inboxes')
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,recoveryUrl:'https://example.invalid/synthetic-private-reset'})})
 })
 await page.route('**/api/hq/access?*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"allowed":true}'}))
 await page.route('**/api/hq/**',route=>route.request().url().includes('/support/pin-recovery')?route.fallback():route.fulfill({status:200,contentType:'application/json',body:'{}'}))
}
async function run(){
 await ready()
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
 for(const width of [320,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:800},reducedMotion:'reduce'})
  const page=await context.newPage(),sends=[],jsErrors=[]
  page.on('pageerror',e=>jsErrors.push(e.message))
  await install(page,sends)
  const response=await page.goto(ROOT+'/hq/support/pin-recovery',{waitUntil:'domcontentloaded'})
  try{await page.getByRole('heading',{name:'PIN recovery',exact:true}).waitFor({timeout:20000})}
  catch(error){
   console.error('HQ browser navigation diagnostics',JSON.stringify({status:response?.status(),url:page.url(),body:(await page.locator('body').innerText()).slice(0,2400),jsErrors}))
   const screenshotPath=path.join(os.tmpdir(),'hq-recovery-failed-'+width+'.png')
   await page.screenshot({path:screenshotPath,fullPage:true}).catch(()=>{})
   console.error('Screenshot:',screenshotPath)
   throw error
  }
  try { await page.getByRole('button',{name:/1 possible inbox/}).click({timeout:8000}) }
  catch(error) {
   console.error('HQ request click diagnostics',JSON.stringify({url:page.url(),
    body:(await page.locator('body').innerText()).slice(0,2600),
    buttons:await page.getByRole('button').allTextContents(),
    jsErrors}))
   throw error
  }
  await page.getByText('Possible matching inbox').waitFor()
  assert.equal(await page.getByPlaceholder('Recipient UUID').count(),0,'Never expose raw UUID entry')
  let approve=page.getByRole('button',{name:'Approve & generate reset link'})
  assert(await approve.isDisabled(),'Require verified evidence before generating reset')
  await page.getByRole('button',{name:/2 possible inboxes/}).click()
  await page.getByText('Choose the verified inbox').waitFor()
  assert.equal(await page.getByRole('radio').count(),2,'Duplicate candidates must be separate')
  assert(await approve.isDisabled())
  await page.getByRole('radio').nth(1).check()
  await page.getByLabel('How was identity independently verified?').fill('Example guardian verification independently completed, reference synthetic-QA-1')
  assert(await approve.isDisabled(),'Evidence alone must not authorize recovery')
  await page.getByRole('checkbox',{name:/I verified the correct recipient/}).check()
  assert(await approve.isEnabled())
  await approve.click()
  await page.getByRole('heading',{name:'PIN recovery'}).waitFor()
  await page.getByText('Reset link generated').waitFor()
  assert.equal(await page.getByLabel('Private PIN reset link').inputValue(),'https://example.invalid/synthetic-private-reset')
  assert.equal(sends.length,1,'Only one authorized reset issued')
  await page.getByRole('button',{name:/No matching PIN inbox found/}).click()
  await page.getByText(/No PIN-protected inbox matches this request/).waitFor()
  assert(await approve.isDisabled(),'No automatic approval when there is no exact matching inbox')
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'HQ recovery page must not overflow at '+width)
  assert.deepEqual(jsErrors,[],'No browser runtime failures at '+width)
  console.log('PASS synthetic HQ recovery identity confirmation at '+width+'px')
  await context.close()
 }
 // Unauthorized API must not expose any recovery candidates.
 const response=await fetch(ROOT+'/api/hq/support/pin-recovery')
 assert.equal(response.status,403,'Anonymous HQ recovery lookup is denied')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 await browser?.close()
 if(server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped}
 fs.closeSync(browserLog)
})
