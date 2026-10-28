// SYNTHETIC UI evidence only. This test never contacts Safaricom.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process')
const path=require('node:path'),os=require('node:os')
const root=process.env.CHECKOUT_TEST_URL||'http://localhost:3097',artifacts='/tmp/checkout-qa/artifacts'
fs.mkdirSync(artifacts,{recursive:true})
;(async()=>{
 const testRoot=path.join(os.tmpdir(),'vibeschool-checkout-browser-'+process.pid)
 if(!process.env.CHECKOUT_TEST_URL){fs.cpSync(process.cwd(),testRoot,{recursive:true,filter:src=>!['node_modules','.next','.git','.cyborg'].includes(path.basename(src))});fs.symlinkSync(path.join(process.cwd(),'node_modules'),path.join(testRoot,'node_modules'),'dir')}
 const log=fs.openSync('/tmp/checkout-qa/browser.log','w')
 const server=process.env.CHECKOUT_TEST_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3097'],{cwd:testRoot,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false'},stdio:['ignore',log,log]})
 let browser
 try{
  for(let i=0;i<120;i++){try{if((await fetch(root+'/api/success-wishes/config')).ok)break}catch{}if(server?.exitCode!==null&&server?.exitCode!==undefined)throw Error('Server stopped');await new Promise(r=>setTimeout(r,1000))}
  browser=await chromium.launch({headless:true})
  for(const width of [320,360,390,412,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(30000)
   const calls=[];let stored=null,failedOnce=false
   await page.route('**/api/success-wishes/checkout',async route=>{
    const p=route.request().postDataJSON();calls.push(p.action)
    if(p.action==='create'){assert.equal(Object.hasOwn(p,'recipientRequest'),false,'Receiver never starts checkout');assert.equal(p.deliveryPhone,'0733000111','Recipient address is distinct from M-Pesa payer');stored={id:'33333333-3333-4333-8333-333333333333',state:'created',amountKes:50,payerPhone:'254712345678',card:{theme:'heritage',candidate:'QA Recipient',sender:'QA Sender',message:'Synthetic checkout proof only.',examYear:'2026',school:''},receipt:null,invitationUrl:null,backupCode:null}}
    if(p.action==='pay'){
     if(!failedOnce&&(width===360||width===390)){
      failedOnce=true
      await route.fulfill({status:width===390?503:200,contentType:'application/json',body:JSON.stringify(width===390?{error:'Synthetic timeout before claim'}:{order:stored,paymentError:'Payment couldn’t start.'})});return
     }
     stored.state='awaiting_customer'
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({order:stored})})
   })
   await page.goto(root+'/',{waitUntil:'domcontentloaded',timeout:120000})
   assert.equal(await page.getByRole('link',{name:/Explore Success Wishes/}).count(),1,'Exactly one public homepage wish promotion')
   await page.waitForFunction(mobile=>[...document.querySelectorAll('footer details[data-footer-group]')].every(d=>d.open!==mobile),width<=640)
   assert.equal(await page.locator('footer details[data-footer-group]').count(),4,'Four accessible footer disclosures')
   if(width===320){
     const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:840}})
     const staticPage=await noJs.newPage()
     await staticPage.goto(root+'/',{waitUntil:'domcontentloaded'})
     assert.equal(await staticPage.locator('footer details[data-footer-group][open]').count(),4,'Footer links remain available without JavaScript')
     await noJs.close()
   }
   await page.goto(root+'/success-wishes',{waitUntil:'networkidle',timeout:120000})
   assert.equal(await page.locator('main').getByRole('link',{name:'Send a wish',exact:true}).count(),1,'Sender entrance is visible')
   assert.equal(await page.locator('main').getByRole('link',{name:'Open a wish',exact:true}).count(),1,'Receiver entrance is visible')
   assert.equal(await page.locator('.receiver-sender-links').count(),0,'No duplicate sender navigation strip')
   assert.equal(await page.locator('header img[src*="vibeschool-wordmark-dark.svg"]').count(),1,'Sender uses readable dark-surface wordmark')
   assert.equal(await page.getByRole('link',{name:'My wishes',exact:true}).count(),1,'Sender retains direct inbox access')
   await page.getByRole('textbox',{name:'Candidate name',exact:true}).fill('QA Recipient')
   await page.getByRole('textbox',{name:'Your name',exact:true}).fill('QA Sender')
   await page.getByRole('textbox',{name:'Phone to receive this wish'}).fill('0733000111')
   await page.getByRole('textbox',{name:'Your wish',exact:true}).fill('Synthetic checkout proof only.')
   await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click()
   let m=page.getByRole('dialog')
   assert.equal(await m.getByText(/Pay to Till 949529/).count(),0,'Removed Till instructions from compact checkout')
   assert.equal(await m.getByText(/The recipient does not need to register/).count(),0,'Removed recipient explanation')
   assert.equal(await m.getByText('Already started a payment?').count(),0,'Removed recovery accordion from new checkout')
   await m.getByRole('heading',{name:'Review your wish'}).waitFor()
   assert.equal(await m.getByRole('button',{name:'Start a new checkout'}).count(),0)
   await m.getByLabel('M-Pesa number',{exact:true}).fill('0712345678')
   await m.getByRole('button',{name:'Pay KSh 50',exact:true}).click()
   if(width===360){await m.getByRole('button',{name:'Try again',exact:true}).click()}
   if(width===390){
    await m.getByRole('heading',{name:'Checking payment'}).waitFor()
    await m.getByRole('button',{name:'Check status',exact:true}).click()
    assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0)
    await m.getByText('Order details',{exact:true}).click()
    assert.equal(await m.getByRole('button',{name:'Start a new checkout'}).count(),0)
    await page.reload({waitUntil:'networkidle'});await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click();m=page.getByRole('dialog')
    await m.getByRole('heading',{name:'Checking payment'}).waitFor()
    assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0,'Reload cannot unlock an uncertain created order')
    stored.state='awaiting_customer';await m.getByRole('button',{name:'Check status',exact:true}).click()
   }
   await m.getByRole('heading',{name:'Check your phone'}).waitFor()
   assert.equal(calls[0],'create');assert.equal(calls.filter(c=>c==='pay').length,width===360?2:1)
   assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0)
   assert.equal(await m.getByRole('button',{name:'Check status',exact:true}).count(),1)
   assert.equal(await m.getByText('M-Pesa: 0712 ••• 678',{exact:true}).count(),1)
   assert.equal(await m.getByText(/Order 33333333/).isVisible(),false,'Order ID stays in details')
   await page.screenshot({path:artifacts+'/pending-'+width+'.png'})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   await page.reload({waitUntil:'networkidle'});await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click();m=page.getByRole('dialog')
   await m.getByRole('heading',{name:'Check your phone'}).waitFor();assert.equal(calls.filter(c=>c==='pay').length,width===360?2:1)
   stored.state='settled';stored.receipt='SYNTHETIC123';stored.invitationUrl='https://vibeschool.co.ke/success-wishes/gift#token='+'b'.repeat(64);stored.backupCode=null
   await m.getByRole('button',{name:'Check status'}).click();await m.getByRole('heading',{name:'Your wish is ready'}).waitFor()
   assert.equal(await m.getByLabel('Private card link',{exact:true}).inputValue(),stored.invitationUrl);assert.equal(await m.getByLabel('Backup card code').count(),0,'No unusable code displayed')
   await page.screenshot({path:artifacts+'/checkout-'+width+'.png'});await context.close();console.log('PASS checkout width '+width+': review, saved order, single payment action, refresh recovery, receipt, exact link/code')
  }
  // Recipient setup must be usable before any card/order exists.
  const setupContext=await browser.newContext({viewport:{width:390,height:900}}),setupPage=await setupContext.newPage()
  const setupToken='d'.repeat(64),setupCalls=[]
  await setupPage.route('**/api/success-wishes/receiver/verify',async route=>{
   const body=route.request().postDataJSON();setupCalls.push(body)
   assert.equal(body.setupToken,setupToken);assert.equal(Object.hasOwn(body,'phone'),false)
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().method()==='POST'?{challengeId:'11111111-1111-4111-8111-111111111111',consentRole:'adult'}:{ok:true,recoveryCode:'SYNTHETIC-RECOVERY-ONLY'})})
  })
  await setupPage.goto(root+'/success-wishes/verify#setup='+setupToken,{waitUntil:'networkidle'})
  assert.equal(setupCalls.length,0)
  await setupPage.getByRole('button',{name:'Send my code',exact:true}).click()
  await setupPage.getByLabel('SMS verification code',{exact:true}).fill('123456')
  assert.equal(await setupPage.getByRole('button',{name:'Verify & open inbox',exact:true}).isDisabled(),true)
  await setupPage.getByRole('checkbox',{name:/I confirm I am at least 18/}).check()
  await setupPage.getByRole('button',{name:'Verify & open inbox',exact:true}).click()
  await setupPage.getByRole('heading',{name:'Your private inbox is ready'}).waitFor()
  assert.equal(setupCalls.length,2);assert.equal(setupCalls[1].consentRole,'adult');assert.equal(setupCalls[1].consentAcknowledged,true)
  await setupContext.close();console.log('PASS pre-payment adult setup: no card required, private capability, affirmative consent, inbox recovery')
 }finally{
  await browser?.close()
  if(server){
   // Wait for Next's child process to stop writing before removing its workspace.
   const stopped=new Promise(resolve=>server.once('exit',resolve))
   if(server.exitCode===null){server.kill('SIGTERM');await stopped}
   fs.closeSync(log)
   fs.rmSync(testRoot,{recursive:true,force:true,maxRetries:3,retryDelay:100})
  }else fs.closeSync(log)
 }
})().catch(e=>{console.error(e);process.exitCode=1})
