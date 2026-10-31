'use strict'
// Current public checkout: FREE with code, without payment. Synthetic browser evidence only.
const assert=require('node:assert/strict')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const {spawn}=require('node:child_process'),{chromium}=require('playwright')
const root=process.env.CHECKOUT_TEST_URL||'http://localhost:3097'
const artifacts=process.env.CI?'qa/success-wishes/artifacts':path.join(os.tmpdir(),'checkout-qa','artifacts')
fs.mkdirSync(artifacts,{recursive:true})
const token='b'.repeat(64),invite='https://vibeschool.co.ke/success-wishes/gift#token='+token
function answer(route,payload,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload),headers:{'Cache-Control':'no-store'}})}
async function fill(page,field,label,value){
 const block=page.locator('[data-wish-field="'+field+'"]')
 if(!await block.evaluate(el=>el.open))await block.locator('summary').click()
 await block.getByRole('textbox',{name:label,exact:true}).fill(value)
}
;(async()=>{
 const temp=path.join(os.tmpdir(),'vibeschool-free-checkout-browser-'+process.pid),logFile=path.join(os.tmpdir(),'checkout-qa','browser.log')
 fs.mkdirSync(path.dirname(logFile),{recursive:true})
 if(!process.env.CHECKOUT_TEST_URL){fs.cpSync(process.cwd(),temp,{recursive:true,filter:src=>!['node_modules','.next','.git','.cyborg'].includes(path.basename(src))});fs.symlinkSync(path.join(process.cwd(),'node_modules'),path.join(temp,'node_modules'),'dir')}
 const log=fs.openSync(logFile,'w')
 const server=process.env.CHECKOUT_TEST_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3097'],{cwd:temp,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false'},stdio:['ignore',log,log]})
 let browser
 try{
  let ready=false
  for(let i=0;i<100;i++){if(server&&server.exitCode!==null)throw Error('Free checkout test server exited');try{if((await fetch(root+'/api/success-wishes/config')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,1000))}
  assert(ready,'Free checkout test server not ready')
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:width===320?740:900}})
   await context.addInitScript(()=>{try{sessionStorage.setItem('success-wishes-2026-floating-offer-dismissed','1')}catch{}})
   const page=await context.newPage(),errors=[],calls=[]
   page.on('pageerror',e=>errors.push(e.message))
   page.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'Synthetic WhatsApp destination'}))
   await page.route('**/api/success-wishes/checkout',async route=>{calls.push('PAID:'+route.request().method());await answer(route,{error:'Payments disabled'},503)})
   await page.route('**/api/success-wishes/campaign',async route=>{
    const data=route.request().postDataJSON()
    if(data.action==='validate'){calls.push('VALIDATE');return answer(route,width===390?{valid:true}:{valid:false,error:'Code unavailable.'},width===390?200:503)}
    calls.push('SEND')
    assert.equal(width,390,'Disabled-code pages never submit gifts')
    assert.equal(data.code,'DNJIMAX3')
    assert.equal(data.senderPhone,'0712345678')
    assert.equal(data.candidate,'QA Recipient')
    assert.equal(data.deliveryPhone,'0733000111')
    return answer(route,{invitationUrl:invite})
   })
   const response=await page.goto(root+'/success-wishes',{waitUntil:'domcontentloaded',timeout:120000})
   assert.equal(response.status(),200)
   await page.locator('#wish-composer[data-draft-hydrated="true"]').waitFor()
   await fill(page,'candidate','Candidate name','QA Recipient')
   await fill(page,'phone','Phone to receive this wish','0733000111')
   await fill(page,'sender','Your name','QA Sender')
   await fill(page,'message','Your wish','Synthetic congratulations for your exams.')
   const send=page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'})
   await send.waitFor({state:'visible'})
   await send.click()
   const modal=page.getByRole('dialog')
   await modal.getByRole('heading',{name:'Review your wish'}).waitFor()
   assert.equal(await modal.getByRole('button',{name:'Pay KSh 50'}).count(),0,'Payment stays hidden in FREE mode')
   assert.equal(await modal.getByLabel('M-Pesa number').count(),0,'No M-Pesa entry in FREE mode')
   await modal.getByLabel('Your free-card code').waitFor()
   assert.equal(calls.length,0,'Opening the review triggers neither payment nor gift delivery')
   await modal.getByRole('button',{name:'Apply',exact:true}).click()
   if(width===390){
    await modal.getByText('Code applied · FREE',{exact:false}).waitFor()
    await modal.getByRole('textbox',{name:'Sender phone'}).fill('0712345678')
    await modal.getByRole('button',{name:'Send Free Card'}).click()
    await page.waitForURL(/^https:\/\/wa\.me\/254733000111\?text=/)
    const url=new URL(page.url()),message=url.searchParams.get('text')||''
    assert(message.includes(invite),'WhatsApp contains the exact private gift link')
    assert(message.includes('QA Recipient'),'WhatsApp identifies the intended recipient')
    assert.deepEqual(calls,['VALIDATE','SEND'],'Only one free send occurs after code validation')
   }else{
    await modal.getByRole('alert').filter({hasText:'Code unavailable.'}).waitFor()
    assert.equal(await modal.getByRole('button',{name:'Send Free Card'}).count(),0)
    assert.deepEqual(calls,['VALIDATE'],'Invalid code cannot send or charge')
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No checkout overflow at '+width)
   }
   assert.deepEqual(errors,[],'No browser errors at '+width)
   await context.close()
   console.log('PASS FREE checkout: no M-Pesa, code gated, WhatsApp privacy at '+width+'px')
  }
 }finally{
  await browser?.close()
  if(server){const stopped=new Promise(resolve=>server.once('exit',resolve));if(server.exitCode===null){server.kill('SIGTERM');await stopped};fs.closeSync(log);fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
  else fs.closeSync(log)
 }
})().catch(err=>{console.error(err);process.exitCode=1})
