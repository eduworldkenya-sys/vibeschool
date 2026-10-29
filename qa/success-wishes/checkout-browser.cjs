// SYNTHETIC UI evidence only. This test never contacts Safaricom.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process')
const path=require('node:path'),os=require('node:os')
const root=process.env.CHECKOUT_TEST_URL||'http://localhost:3097',artifacts=process.env.CI?'qa/success-wishes/artifacts':'/tmp/checkout-qa/artifacts'
fs.mkdirSync(artifacts,{recursive:true})
;(async()=>{
 const testRoot=path.join(os.tmpdir(),'vibeschool-checkout-browser-'+process.pid)
 if(!process.env.CHECKOUT_TEST_URL){fs.cpSync(process.cwd(),testRoot,{recursive:true,filter:src=>!['node_modules','.next','.git','.cyborg'].includes(path.basename(src))});fs.symlinkSync(path.join(process.cwd(),'node_modules'),path.join(testRoot,'node_modules'),'dir')}
 const logPath=path.join(os.tmpdir(),'checkout-qa','browser.log')
 fs.mkdirSync(path.dirname(logPath),{recursive:true})
 const log=fs.openSync(logPath,'w')
 const server=process.env.CHECKOUT_TEST_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3097'],{cwd:testRoot,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false'},stdio:['ignore',log,log]})
 let browser
 try{
  for(let i=0;i<120;i++){try{if((await fetch(root+'/api/success-wishes/config')).ok)break}catch{}if(server?.exitCode!==null&&server?.exitCode!==undefined)throw Error('Server stopped');await new Promise(r=>setTimeout(r,1000))}
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}: {})})
  for(const width of [320,360,390,412,768,1280]){
   const context=await browser.newContext({viewport:{width,height:width===320?640:900}}),page=await context.newPage();page.setDefaultTimeout(30000)
   const calls=[];let stored=null,failedOnce=false,missingOnRestore=false
   if(width===320)await page.addInitScript(()=>{
    window.__qaNotes=0
    const original=AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator=function(...args){window.__qaNotes++;return original.apply(this,args)}
    Object.defineProperty(navigator,'share',{value:async data=>{window.__qaShared=data;throw new DOMException('Cancelled','AbortError')}})
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__qaCopied=text}}})
   })

   if(width===768)await page.addInitScript(()=>{if(!sessionStorage.getItem('qa-orphan-seeded')){sessionStorage.setItem('qa-orphan-seeded','1');sessionStorage.setItem('vs-success-wish-checkout-v1',JSON.stringify({key:'e'.repeat(64),expires:Date.now()+60000,paymentUncertain:false}))}})
   await page.route('**/api/success-wishes/checkout',async route=>{
    const p=route.request().postDataJSON();calls.push(p.action)
    if(p.action==='status'&&missingOnRestore){missingOnRestore=false;await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Synthetic missing order during uncertainty'})});return}
    if(p.action==='status'&&!stored){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'No saved order was found for this recovery key.'})});return}
    if(p.action==='create'){if(width===768)assert.notEqual(p.key,'e'.repeat(64),'Missing unclaimed key is replaced before create');assert.equal(Object.hasOwn(p,'recipientRequest'),false,'Receiver never starts checkout');assert.equal(p.deliveryPhone,'0733000111','Recipient address is distinct from M-Pesa payer');stored={id:'33333333-3333-4333-8333-333333333333',state:'created',amountKes:50,payerPhone:'254712345678',card:{theme:'heritage',candidate:'QA Recipient',sender:'QA Sender',message:'Synthetic checkout proof only.',examYear:'2026',school:'',deliveryPhone:'0733000111'},receipt:null,invitationUrl:null,backupCode:null}}
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
   assert.equal(await page.getByRole('progressbar',{name:'Wish details completed'}).count(),0,'Progress waits for editing')
   assert.equal(await page.locator('#wish-composer details[open]').count(),1,'Only the active section starts open')
   await page.getByRole('textbox',{name:'Candidate name',exact:true}).fill('QA Recipient')
   assert.equal(await page.getByRole('textbox',{name:'Candidate name',exact:true}).isVisible(),true,'Typing does not collapse the active section')
   if(width===320){
    await page.getByRole('textbox',{name:'Candidate name',exact:true}).press('Enter')
    assert.equal(await page.getByRole('textbox',{name:'Exam year',exact:true}).evaluate(el=>el===document.activeElement),true,'Keyboard Next moves to the year before advancing')
    await page.getByRole('textbox',{name:'Exam year',exact:true}).press('Enter')
   }else await page.getByRole('button',{name:'Next: school',exact:true}).click()
   assert.equal(await page.getByRole('combobox',{name:'School (optional)'}).evaluate(e=>e===document.activeElement),true,'Next opens and focuses school without manual scrolling')
   assert.equal(await page.locator('#wish-composer details[open]').count(),1)
   assert.equal(await page.locator('#wish-composer details').first().getByText('QA Recipient · 2026',{exact:true}).isVisible(),true,'Candidate becomes an editable compact summary')
   await page.getByRole('button',{name:'Skip school',exact:true}).click()
   await page.getByRole('textbox',{name:'Phone to receive this wish'}).fill('0733000111')
   await page.getByRole('button',{name:'Next: your name',exact:true}).click()
   await page.getByRole('textbox',{name:'Your name',exact:true}).fill('QA Sender')
   await page.getByRole('button',{name:'Next: your wish',exact:true}).click()
   await page.getByRole('textbox',{name:'Your wish',exact:true}).fill('Synthetic checkout proof only.')
   assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'4','Skipping optional school does not block progress')
   assert.equal(await page.locator('#wish-composer details[open]').count(),1)
   assert.equal(await page.locator('#wish-composer details').first().evaluate(el=>getComputedStyle(el).boxShadow),'none','Sections have no shadow')
   const editor=page.locator('[data-wish-field="message"]')
   assert.equal(await editor.evaluate(el=>getComputedStyle(el.parentElement).boxShadow),'none','The form is flat')
   await editor.locator('..').screenshot({path:artifacts+'/compact-form-'+width+'.png'})
   const formHeight=await editor.evaluate(el=>el.parentElement.getBoundingClientRect().height)
   assert(formHeight<760,`Active editor and all summaries stay compact: ${formHeight}px`)
   assert(await page.getByRole('textbox',{name:'Your wish',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'Next keeps the input visible without a manual scroll')
   await editor.locator('..').screenshot({path:artifacts+'/compact-form-'+width+'.png'})

   if(width===320){
    await page.locator('[data-wish-field="candidate"] > summary').press('Enter')
    const year=page.getByRole('textbox',{name:'Exam year',exact:true,includeHidden:true})
    await year.fill('20')
    await page.locator('[data-wish-field="message"] > summary').click()
    await page.locator('[data-wish-field="candidate"] > summary').click()
    await page.getByText('Enter a four-digit exam year, such as 2026.',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Next: school',exact:true}).isDisabled(),true,'Invalid year cannot advance')
    assert.equal(await year.inputValue(),'20','Reopening retains the invalid value for correction')
    await year.fill('2026')
    await page.locator('[data-wish-field="message"] > summary').click()
   }
   const ideas=await page.getByText('Need a wish?',{exact:true}).boundingBox(),messageBox=await page.getByRole('textbox',{name:'Your wish',exact:true}).boundingBox()
   assert(ideas.y<messageBox.y,'Wish suggestions appear above the editor')
   page.once('dialog',dialog=>dialog.dismiss())
   await page.getByRole('button',{name:/Use wish starter:/}).first().click()
   assert.equal(await page.getByRole('textbox',{name:'Your wish',exact:true}).inputValue(),'Synthetic checkout proof only.','Declining replacement preserves writing')
   assert.equal(await page.getByRole('button',{name:'Turn wish sounds on'}).count(),1,'Sound starts off')
   if(width===320){
    assert.equal(await page.evaluate(()=>window.__qaNotes),0,'Focusing and writing are silent by default')
    await page.getByRole('button',{name:'Turn wish sounds on'}).click()
    if(!await page.locator('#wish-composer details').last().evaluate(el=>el.open))await page.locator('#wish-composer details').last().locator('summary').click()
    const wish=page.getByRole('textbox',{name:'Your wish',exact:true})
    await wish.fill('Synthetic checkout proof only. Edited')
    assert.equal(await page.evaluate(()=>window.__qaNotes),4,'Typing starts the short melody after opt-in')
    await wish.fill('Synthetic checkout proof only.')
    assert.equal(await page.evaluate(()=>window.__qaNotes),4,'Further typing does not restart the melody')
   }


   await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click()
   let m=page.getByRole('dialog')
   assert.equal(await m.getByText(/Pay to Till 949529/).count(),0,'Removed Till instructions from compact checkout')
   assert.equal(await m.getByText(/The recipient does not need to register/).count(),0,'Removed recipient explanation')
   assert.equal(await m.getByText('Already started a payment?').count(),0,'Removed recovery accordion from new checkout')
   await m.getByRole('heading',{name:'Review your wish'}).waitFor()
   if(width===768){await m.getByLabel('M-Pesa number',{exact:true}).waitFor();assert(calls.length>=1&&calls.every(action=>action==='status'),'Only read-only status checks may recover a missing unclaimed order');calls.length=0}
   assert.equal(await m.getByRole('button',{name:'Start a new checkout'}).count(),0)
   if(width===320){
    await m.getByLabel('M-Pesa number',{exact:true}).fill('07')
    await m.getByRole('button',{name:'Pay KSh 50',exact:true}).click()
    await m.getByRole('alert').waitFor();assert.equal(calls.length,0,'Invalid phone cannot create an order')
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('vs-success-wish-checkout-v1')),null,'Invalid phone cannot strand a recovery key')
   }
   await m.getByLabel('M-Pesa number',{exact:true}).fill('0712345678')
   await m.getByRole('button',{name:'Pay KSh 50',exact:true}).click()
   if(width===360){await m.getByRole('button',{name:'Try again',exact:true}).click()}
   if(width===390){
    await m.getByRole('heading',{name:'Confirming payment'}).waitFor()
    await m.getByRole('button',{name:'Check status',exact:true}).click()
    assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0)
    await m.getByText('Order details',{exact:true}).click()
    assert.equal(await m.getByRole('button',{name:'Start a new checkout'}).count(),0)
    missingOnRestore=true
    await page.reload({waitUntil:'networkidle'});await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click();m=page.getByRole('dialog')
    await m.getByRole('heading',{name:'Confirming payment'}).waitFor()
    await m.getByRole('alert').filter({hasText:'Your saved order couldn’t be checked.'}).waitFor()
    assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0,'A missing uncertain order cannot unlock Pay')
    assert.equal(await m.getByRole('button',{name:'Edit',exact:true}).count(),0)
    assert.equal(await m.getByRole('button',{name:'Start a new checkout'}).count(),0)
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
   if(width===320||width===412){
    stored.state='failed'
    await m.getByRole('button',{name:'Check status',exact:true}).click()
    await m.getByText('Payment wasn’t completed.',{exact:true}).waitFor()
    const before=calls.length,oldKey=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('vs-success-wish-checkout-v1')).key)
    await m.getByRole('button',{name:'Try again',exact:true}).click()
    await m.getByLabel('M-Pesa number',{exact:true}).waitFor()
    assert.equal(await m.getByLabel('M-Pesa number',{exact:true}).inputValue(),'254712345678')
    assert.deepEqual(calls.slice(before),['status'],'Retry first verifies terminal failure without requesting payment')
    await m.getByRole('button',{name:'Pay KSh 50',exact:true}).click()
    await m.getByRole('heading',{name:'Check your phone'}).waitFor()
    const newKey=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('vs-success-wish-checkout-v1')).key)
    assert.notEqual(newKey,oldKey,'New attempt cannot reuse a terminal failed order key')
    assert.deepEqual(calls.slice(before),['status','create','pay'])
   }
   stored.state='settled';stored.receipt='SYNTHETIC123';stored.invitationUrl='https://vibeschool.co.ke/success-wishes/gift#token='+'b'.repeat(64);stored.backupCode=null
   await m.getByRole('button',{name:'Check status'}).click();await m.getByRole('heading',{name:'Your success card is ready!'}).waitFor()
   await m.getByText('View link',{exact:true}).click()
   assert.equal(await m.getByLabel('Private card link',{exact:true}).inputValue(),stored.invitationUrl);assert.equal(await m.getByLabel('Backup card code').count(),0,'No unusable code displayed')
   const share=await m.getByRole('link',{name:'Share on WhatsApp'}).getAttribute('href')
   assert.equal(new URL(share).searchParams.get('text').endsWith(stored.invitationUrl),true,'WhatsApp includes the exact gift token')
   if(width===320){
    await m.getByRole('button',{name:'More sharing options'}).click()
    assert((await page.evaluate(()=>window.__qaShared.text)).endsWith(stored.invitationUrl),'Native sharing retains complete private link')
    assert.equal(await m.getByRole('heading',{name:'Your success card is ready!'}).count(),1,'Cancelled sharing never claims sent')
    await m.getByRole('button',{name:'Copy link',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.__qaCopied),stored.invitationUrl)
    await m.getByRole('button',{name:'Link copied ✓',exact:true}).waitFor()
    stored.deliveryStatus='accepted'
    await m.getByRole('button',{name:'Close checkout'}).click()
    await page.locator('#wish-composer [class*="sendRow"]').getByRole('button',{name:'Send this wish'}).click()
    m=page.getByRole('dialog')
    await m.getByRole('heading',{name:'Success card invitation sent!'}).waitFor()
    assert.equal(await m.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0,'Confirmed sent restoration never requests a second payment')
   }
   await page.screenshot({path:artifacts+'/checkout-'+width+'.png'});await context.close();console.log('PASS checkout width '+width+': review, saved order, single payment action, refresh recovery, receipt, exact link/code')
  }
  const giftContext=await browser.newContext({viewport:{width:390,height:900}}),giftPage=await giftContext.newPage()
  const giftToken='c'.repeat(64),giftLink='https://vibeschool.co.ke/success-wishes/gift#token='+giftToken
  let reveals=0
  await giftPage.route('**/api/success-wishes/gift',async route=>{
   assert.equal(route.request().postDataJSON().token,giftToken)
   if(route.request().method()==='PUT')reveals++
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({card:{id:'synthetic-gift',theme:'heritage',candidate:'QA Recipient',school:'',examYear:'2026',sender:null}})})
  })
  await giftPage.goto(root+'/success-wishes/gift#token='+giftToken,{waitUntil:'networkidle'})
  const giftShare=giftPage.getByRole('link',{name:'Share on WhatsApp'})
  assert.equal(new URL(await giftShare.getAttribute('href')).searchParams.get('text').endsWith(giftLink),true)
  assert.equal(reveals,0,'Preparing a share must not open or alter the sealed gift')
  await giftContext.close();console.log('PASS private gift page WhatsApp action preserves sealed state and complete token')
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
