'use strict'
// Controlled no-SMS browser journey; separate SQL/route suites prove trusted authorization.
const assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const ROOT='http://localhost:3093',ID='11111111-1111-4111-8111-111111111111',TOKEN='a'.repeat(64),MESSAGE='Trust your preparation. We believe in you.'
const screenshots=process.env.CI?path.join(process.cwd(),'qa/success-wishes/artifacts'):path.join(os.tmpdir(),'success-wishes-artifacts');fs.mkdirSync(screenshots,{recursive:true})
const log=fs.openSync(path.join(os.tmpdir(),'success-wishes-receiver-browser.log'),'w'),env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false',SUCCESS_WISHES_RECEIVER_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}
if(!process.env.RECEIVER_USE_EXISTING_BUILD&&!process.env.RECEIVER_DEV_SERVER)execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:['ignore',log,log],timeout:600000})
const server=spawn(process.execPath,['node_modules/next/dist/bin/next',process.env.RECEIVER_DEV_SERVER?'dev':'start','--port','3093'],{env,stdio:['ignore',log,log]});let browser
async function ready(){for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Server stopped');try{if((await fetch(ROOT+'/api/success-wishes/config')).ok)return}catch{}await new Promise(r=>setTimeout(r,1000))}throw Error('Server did not start')}
function mocks(page,state){page.route('**/api/success-wishes/**',async route=>{
 const req=route.request(),u=new URL(req.url()),method=req.method(),b=method==='GET'?{}:req.postDataJSON()||{};let status=200,p={}
 const card={id:ID,source:'paid',candidate:'Charles',school:'Example school',examYear:'2026',theme:state.theme,sender:'Mum',opened:state.opened}
 if(u.pathname.endsWith('/config'))p={enabled:false}
 else if(u.pathname.endsWith('/account')){
  if(method==='GET'){if(!state.login){status=401;p={error:'Unlock your wishes.'}}else p={recipient:{id:ID,name:state.name||'Charles',school:'Example school',phone:'+254733000111',examYear:'2026'}}}
  else if(method==='DELETE'){if(state.deletePause)await state.deletePause;state.login=false;p={ok:true,inboxId:ID}}
  else if(b.action==='login'){if(b.pin!=='0123'){status=401;p={error:'Check your details or use your private recovery link.'}}else{state.login=true;p={ok:true,inboxId:ID}}}
  else if(b.action==='create'||b.action==='recover'){assert.equal(b.pin,'0123');state.login=true;p={ok:true,inboxId:ID,recoveryUrl:ROOT+'/success-wishes/recover#recovery='+TOKEN}}
  else if(b.action==='attach'){state.saved=true;p={ok:true,inboxId:ID}}
  else if(b.action==='confirm_recovery')p={ok:true,inboxId:ID}
  else{status=400;p={error:'Unexpected account action'}}
 }else if(u.pathname.endsWith('/collection')){
  if(!state.login){status=401;p={error:'Unlock your wishes.'}}
  else if(method==='GET'){if(state.loadPause)await state.loadPause;p={recipient:{id:ID,name:state.name||'Charles',school:'Example school'},cards:[card,{...card,id:'22222222-2222-4222-8222-222222222222',sender:'Aunt Jane',opened:true,source:state.legacy?'legacy':'paid'}]}}
  else{if(state.initialPause)await state.initialPause;if(b.reveal&&state.revealPause)await state.revealPause;if(b.reveal)state.opened=true;p={card:{...card,...(b.reveal?{sender:'Mum',message:MESSAGE,opened:true}:{})}}}
 }else if(u.pathname.endsWith('/gift')){if(method==='PUT')state.opened=true;p={card:{...card,...(method==='PUT'?{sender:'Mum',message:MESSAGE,opened:true}:{})}}}
 else if(u.pathname.endsWith('/remembered'))p={cards:[]}
 else if(u.pathname.endsWith('/request')){if(!state.login){status=401;p={error:'Unlock your wishes.'}}else p={id:ID,phone:'+254733000222',url:ROOT+'/success-wishes/invite#token='+TOKEN,expiresInDays:7}}
 else if(u.pathname.endsWith('/inbox')&&method==='DELETE'){state.login=false;p={ok:true}}
 else if(u.pathname.endsWith('/inbox')&&method==='POST'){if(state.openPause)await state.openPause;p={url:ROOT+'/success-wishes/gift?source=paid&card='+ID}}
 else{status=404;p={error:'Unexpected route'}}
 await route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(p)})
})}
async function signOut(page){
 let scope=page.locator('.receiver-sidebar')
 if(!await scope.isVisible()){await page.getByRole('button',{name:'Open receiver menu',exact:true}).filter({visible:true}).first().click();scope=page.getByRole('dialog',{name:'Receiver navigation menu'})}
 const settings=scope.locator('details.receiver-account-options');if(!await settings.evaluate(el=>el.open))await settings.locator('summary').click()
 await scope.getByRole('button',{name:'Sign out',exact:true}).click()
}
async function noOverflow(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' horizontal overflow')}
async function run(){await ready();browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
 for(const [index,width] of [320,360,390,412,768,1280].entries()){
  const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],state={login:true,opened:false,theme:['heritage','botanical','nightfall','sunrise'][index%4]};page.on('pageerror',e=>errors.push(e.message));mocks(page,state)
  await page.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();await page.getByRole('button',{name:/^Open wish 1,/}).waitFor();assert.equal(await page.getByText('Unopened',{exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'All 2',exact:true}).count(),1);await page.getByRole('button',{name:'Unopened 1',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Read wish from Aunt Jane'}).count(),0);await page.getByRole('button',{name:'All 2',exact:true}).click();await page.getByRole('textbox',{name:'Search wishes',exact:true}).fill('Aunt Jane');assert.equal(await page.getByRole('button',{name:/^Open wish/}).count(),0);await page.getByRole('textbox',{name:'Search wishes',exact:true}).fill('no-match');await page.getByRole('heading',{name:'No matching wishes'}).waitFor();await page.getByRole('button',{name:'Show all wishes',exact:true}).click();await page.getByRole('textbox',{name:'Search wishes',exact:true}).fill('Mum');await page.getByRole('heading',{name:'No matching wishes'}).waitFor();await page.getByRole('button',{name:'Show all wishes',exact:true}).click();await noOverflow(page,'Inbox '+width);assert(await page.locator('[aria-label="Your wishes"]>button').evaluateAll(cards=>cards.every(card=>{const cover=card.firstElementChild;return cover.getBoundingClientRect().width<=card.getBoundingClientRect().width+1})), 'Gift covers fit their cards at '+width);await page.screenshot({path:path.join(screenshots,'pin-inbox-'+width+'.png'),fullPage:true})
  await page.getByRole('button',{name:/^Open wish 1,/}).click();await page.getByRole('button',{name:'Sound on',exact:true}).filter({visible:true}).first().click();await page.getByRole('button',{name:'Sound off',exact:true}).filter({visible:true}).first().waitFor();await page.getByText(MESSAGE,{exact:true}).waitFor();assert.equal(await page.locator('[data-receiver-view]').getAttribute('data-theme'),state.theme);await noOverflow(page,'Gift '+width);await page.screenshot({path:path.join(screenshots,'pin-gift-'+width+'.png'),fullPage:true});await page.getByRole('button',{name:'Close the book card'}).click();assert.equal(await page.getByText(MESSAGE,{exact:true}).count(),0)
  await page.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'WhatsApp ready'}))
  await page.goto(ROOT+'/success-wishes/request',{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Their WhatsApp number'}).fill('0733000222');await page.getByRole('button',{name:'Share via WhatsApp',exact:true}).click();await page.waitForURL(/^https:\/\/wa.me\/254733000222\?text=/);assert.equal(await page.getByText(/SMS verification/).count(),0)
  await page.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();await signOut(page);await page.waitForURL('**/success-wishes/recover');await page.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await page.getByLabel('PIN or confirmation code',{exact:true}).fill('9999');await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('alert').filter({hasText:'Check your details'}).waitFor();await page.getByLabel('PIN or confirmation code',{exact:true}).fill('0123');await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();assert.equal(await page.getByLabel('PIN or confirmation code',{exact:true}).count(),0)
  await page.goto(ROOT+'/success-wishes/recover#recovery='+TOKEN,{waitUntil:'networkidle'});assert(!page.url().includes('#recovery='));await page.getByLabel('New PIN',{exact:true}).fill('0123');await page.getByLabel('Confirm PIN',{exact:true}).fill('0123');await page.getByRole('button',{name:'Reset PIN',exact:true}).click();await page.getByRole('textbox',{name:'Private recovery link',exact:true}).waitFor();await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();assert.deepEqual(errors,[]);console.log('PIN receiver browser pass:',width);await ctx.close()
 }
 const ctx=await browser.newContext({viewport:{width:390,height:840}}),a=await ctx.newPage(),b=await ctx.newPage(),state={login:true,opened:false,theme:'heritage'};mocks(a,state);mocks(b,state);await a.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await b.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await a.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();await signOut(a);await b.getByRole('heading',{name:'Open my wishes',exact:true}).waitFor();assert.equal(await b.getByRole('button',{name:'Read wish from Aunt Jane'}).count(),0);await ctx.close()
 // Reopening during a slow DELETE cannot retain private rows after revocation completes.
 for(const storageOnly of [false,true]){
  const c=await browser.newContext({viewport:{width:390,height:840}});if(storageOnly)await c.addInitScript(()=>{delete window.BroadcastChannel})
  const first=await c.newPage(),second=await c.newPage(),s={login:true,opened:false,theme:'heritage'};mocks(first,s);mocks(second,s)
  await first.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await second.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await first.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor()
  let release;s.deletePause=new Promise(resolve=>{release=resolve});const sent=first.waitForRequest(r=>r.url().endsWith('/receiver/account')&&r.method()==='DELETE')
  await signOut(first);await sent
  await second.reload({waitUntil:'networkidle'});await second.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor();release();await second.getByRole('heading',{name:'Open my wishes',exact:true}).waitFor();assert.equal(await second.getByRole('button',{name:'Read wish from Aunt Jane'}).count(),0);await c.close()
 }
 // A delayed initial load and delayed reveal must never restore a locked learner's content.
 for(const delayed of ['initialPause','revealPause']){
  const c=await browser.newContext({viewport:{width:390,height:840}}),gift=await c.newPage(),locker=await c.newPage(),s={login:true,opened:false,theme:'heritage'};mocks(gift,s);mocks(locker,s)
  await locker.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await locker.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor()
  let release;const pause=new Promise(resolve=>{release=resolve})
  s[delayed]=pause
  const started=gift.waitForRequest(r=>r.url().endsWith('/receiver/collection')&&r.method()==='POST')
  const navigation=gift.goto(ROOT+'/success-wishes/gift?source=paid&card='+ID,{waitUntil:'domcontentloaded'})
  await navigation
  await started
  await signOut(locker);await gift.getByRole('alert').filter({hasText:'Your inbox changed'}).waitFor();release();await gift.waitForLoadState('networkidle');assert.equal(await gift.getByText(MESSAGE,{exact:true}).count(),0);assert.equal(await gift.locator('[data-receiver-view]').count(),0);await c.close()
 }
 // Sidebar logout must clear PIN tabs, not just the older verified-session tabs.
 const desktop=await browser.newContext({viewport:{width:1280,height:840}}),home=await desktop.newPage(),other=await desktop.newPage(),logoutState={login:true,opened:false,theme:'heritage'};mocks(home,logoutState);mocks(other,logoutState)
 await home.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await other.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await home.getByRole('button',{name:'Read wish from Aunt Jane'}).waitFor()
 await signOut(home);await other.getByRole('heading',{name:'Open my wishes',exact:true}).waitFor();assert.equal(await other.getByRole('button',{name:'Read wish from Aunt Jane'}).count(),0);await desktop.close()
 // Refreshing the inbox while a legacy card opens must not strand its opening lock.
 const legacyContext=await browser.newContext({viewport:{width:390,height:840}}),legacyPage=await legacyContext.newPage(),legacyState={login:true,opened:false,theme:'heritage',legacy:true};mocks(legacyPage,legacyState)
 await legacyPage.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});let releaseOpen;legacyState.openPause=new Promise(resolve=>{releaseOpen=resolve})
 const startedOpen=legacyPage.waitForRequest(r=>r.url().endsWith('/receiver/inbox')&&r.method()==='POST');await legacyPage.getByRole('button',{name:'Read wish from Aunt Jane'}).click();await startedOpen
 const refreshed=legacyPage.waitForRequest(r=>r.url().endsWith('/receiver/collection')&&r.method()==='GET');await legacyPage.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await refreshed;releaseOpen();await legacyPage.waitForURL('**/success-wishes/gift?**');await legacyPage.getByText(MESSAGE,{exact:true}).waitFor();await legacyContext.close()
 // Locking this tab during an in-flight legacy open must never navigate afterward.
 const lockedContext=await browser.newContext({viewport:{width:390,height:840}}),lockedPage=await lockedContext.newPage(),lockedState={login:true,opened:false,theme:'heritage',legacy:true};mocks(lockedPage,lockedState)
 await lockedPage.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});let releaseLocked;lockedState.openPause=new Promise(resolve=>{releaseLocked=resolve});const pendingOpen=lockedPage.waitForRequest(r=>r.url().endsWith('/receiver/inbox')&&r.method()==='POST');await lockedPage.getByRole('button',{name:'Read wish from Aunt Jane'}).click();await pendingOpen
 await signOut(lockedPage);await lockedPage.waitForURL('**/success-wishes/recover');releaseLocked();await lockedPage.waitForLoadState('networkidle');assert(new URL(lockedPage.url()).pathname.endsWith('/recover'));assert.equal(await lockedPage.getByRole('button',{name:'Read wish from Aunt Jane'}).count(),0);await lockedContext.close()
 const noJs=await browser.newContext({javaScriptEnabled:false}),page=await noJs.newPage();await page.goto(ROOT+'/success-wishes/recover');assert(await page.getByLabel('New PIN',{exact:true}).isDisabled());await noJs.close();console.log('No-SMS receiver browser, cross-tab lock and hydration gates passed')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM')})
