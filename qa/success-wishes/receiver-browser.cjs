'use strict'
// Controlled no-SMS browser journey; separate SQL/route suites prove trusted authorization.
const assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const ROOT='http://localhost:3093',ID='11111111-1111-4111-8111-111111111111',TOKEN='a'.repeat(64),MESSAGE='Trust your preparation. We believe in you.'
const screenshots=process.env.CI?path.join(process.cwd(),'qa/success-wishes/artifacts'):path.join(os.tmpdir(),'success-wishes-artifacts');fs.mkdirSync(screenshots,{recursive:true})
const log=fs.openSync(path.join(os.tmpdir(),'success-wishes-receiver-browser.log'),'w'),env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false',SUCCESS_WISHES_RECEIVER_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}
if(!process.env.RECEIVER_USE_EXISTING_BUILD)execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:['ignore',log,log],timeout:600000})
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3093'],{env,stdio:['ignore',log,log]});let browser
async function ready(){for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Server stopped');try{if((await fetch(ROOT+'/api/success-wishes/config')).ok)return}catch{}await new Promise(r=>setTimeout(r,1000))}throw Error('Server did not start')}
function mocks(page,state){page.route('**/api/success-wishes/**',async route=>{
 const req=route.request(),u=new URL(req.url()),method=req.method(),b=method==='GET'?{}:req.postDataJSON()||{};let status=200,p={}
 const card={id:ID,source:'paid',candidate:'Charles',school:'Example school',examYear:'2026',theme:state.theme,sender:state.opened?'Mum':null,opened:state.opened}
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
  else if(method==='GET'){if(state.loadPause)await state.loadPause;p={recipient:{id:ID,name:state.name||'Charles',school:'Example school'},cards:[card,{...card,id:'22222222-2222-4222-8222-222222222222',sender:'Aunt Jane',opened:true}]}}
  else{if(!b.reveal&&state.initialPause)await state.initialPause;if(b.reveal&&state.revealPause)await state.revealPause;if(b.reveal)state.opened=true;p={card:{...card,...(b.reveal?{sender:'Mum',message:MESSAGE,opened:true}:{})}}}
 }else if(u.pathname.endsWith('/gift')){if(method==='PUT')state.opened=true;p={card:{...card,...(method==='PUT'?{sender:'Mum',message:MESSAGE,opened:true}:{})}}}
 else if(u.pathname.endsWith('/request')){if(!state.login){status=401;p={error:'Unlock your wishes.'}}else p={id:ID,phone:'+254733000222',url:ROOT+'/success-wishes/invite#token='+TOKEN,expiresInDays:7}}
 else{status=404;p={error:'Unexpected route'}}
 await route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(p)})
})}
async function noOverflow(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' horizontal overflow')}
async function run(){await ready();browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||chromium.executablePath()})
 for(const [index,width] of [320,360,390,412,768,1280].entries()){
  const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],state={login:true,opened:false,theme:['heritage','botanical','nightfall','sunrise'][index%4]};page.on('pageerror',e=>errors.push(e.message));mocks(page,state)
  await page.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Aunt Jane'}).waitFor();await page.getByRole('button',{name:'A wish for you'}).waitFor();assert.equal(await page.getByText('Sealed Wish',{exact:true}).count(),0);assert.equal(await page.getByText('Heritage Envelope',{exact:true}).count(),0);await noOverflow(page,'Inbox '+width);await page.screenshot({path:path.join(screenshots,'pin-inbox-'+width+'.png'),fullPage:true})
  await page.getByRole('button',{name:'A wish for you'}).click();await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).click();await page.getByText(MESSAGE,{exact:true}).waitFor();assert.equal(await page.locator('[data-receiver-view]').getAttribute('data-theme'),state.theme);await noOverflow(page,'Gift '+width);await page.screenshot({path:path.join(screenshots,'pin-gift-'+width+'.png'),fullPage:true});await page.getByRole('button',{name:'Close the book card'}).click();assert.equal(await page.getByText(MESSAGE,{exact:true}).count(),0)
  await page.goto(ROOT+'/success-wishes/request',{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Their WhatsApp number'}).fill('0733000222');await page.getByRole('button',{name:'Create request',exact:true}).click();const share=page.getByRole('link',{name:'Share via WhatsApp'});await share.waitFor();assert.match(await share.getAttribute('href'),/^https:\/\/wa.me\/254733000222\?text=/);assert.equal(await page.getByText(/SMS verification/).count(),0)
  await page.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Aunt Jane'}).waitFor();await page.getByLabel('Inbox options').click();await page.getByRole('button',{name:'Lock inbox',exact:true}).click();await page.getByLabel('4-digit PIN',{exact:true}).fill('9999');await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('alert').filter({hasText:'Check your details'}).waitFor();await page.getByLabel('4-digit PIN',{exact:true}).fill('0123');await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('button',{name:'Aunt Jane'}).waitFor();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Aunt Jane'}).waitFor();assert.equal(await page.getByLabel('4-digit PIN',{exact:true}).count(),0)
  await page.goto(ROOT+'/success-wishes/recover#recovery='+TOKEN,{waitUntil:'networkidle'});assert(!page.url().includes('#recovery='));await page.getByLabel('New PIN',{exact:true}).fill('0123');await page.getByLabel('Confirm PIN',{exact:true}).fill('0123');await page.getByRole('button',{name:'Reset PIN',exact:true}).click();await page.getByRole('textbox',{name:'Private recovery link',exact:true}).waitFor();await page.getByRole('button',{name:'Open my wishes',exact:true}).click();await page.getByRole('button',{name:'Aunt Jane'}).waitFor();assert.deepEqual(errors,[]);console.log('PIN receiver browser pass:',width);await ctx.close()
 }
 const ctx=await browser.newContext({viewport:{width:390,height:840}}),a=await ctx.newPage(),b=await ctx.newPage(),state={login:true,opened:false,theme:'heritage'};mocks(a,state);mocks(b,state);await a.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await b.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await a.getByRole('button',{name:'Aunt Jane'}).waitFor();await a.getByLabel('Inbox options').click();await a.getByRole('button',{name:'Lock inbox',exact:true}).click();await b.getByRole('heading',{name:'Open my wishes',exact:true}).waitFor();assert.equal(await b.getByRole('button',{name:'Aunt Jane'}).count(),0);await ctx.close()
 // Reopening during a slow DELETE cannot retain private rows after revocation completes.
 for(const storageOnly of [false,true]){
  const c=await browser.newContext({viewport:{width:390,height:840}});if(storageOnly)await c.addInitScript(()=>{delete window.BroadcastChannel})
  const first=await c.newPage(),second=await c.newPage(),s={login:true,opened:false,theme:'heritage'};mocks(first,s);mocks(second,s)
  await first.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await second.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await first.getByRole('button',{name:'Aunt Jane'}).waitFor()
  let release;s.deletePause=new Promise(resolve=>{release=resolve});const sent=first.waitForRequest(r=>r.url().endsWith('/receiver/account')&&r.method()==='DELETE')
  await first.getByLabel('Inbox options').click();await first.getByRole('button',{name:'Lock inbox',exact:true}).click();await sent
  await second.reload({waitUntil:'networkidle'});await second.getByRole('button',{name:'Aunt Jane'}).waitFor();release();await second.getByRole('heading',{name:'Open my wishes',exact:true}).waitFor();assert.equal(await second.getByRole('button',{name:'Aunt Jane'}).count(),0);await c.close()
 }
 // A delayed initial load and delayed reveal must never restore a locked learner's content.
 for(const delayed of ['initialPause','revealPause']){
  const c=await browser.newContext({viewport:{width:390,height:840}}),gift=await c.newPage(),locker=await c.newPage(),s={login:true,opened:false,theme:'heritage'};mocks(gift,s);mocks(locker,s)
  await locker.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'});await locker.getByRole('button',{name:'Aunt Jane'}).waitFor()
  let release;const pause=new Promise(resolve=>{release=resolve})
  if(delayed==='initialPause')s.initialPause=pause
  const started=gift.waitForRequest(r=>r.url().endsWith('/receiver/collection')&&r.method()==='POST')
  const navigation=gift.goto(ROOT+'/success-wishes/gift?source=paid&card='+ID,{waitUntil:'domcontentloaded'})
  await navigation
  if(delayed==='initialPause')await started
  else{await started;await gift.getByRole('button',{name:'Open the envelope and reveal the success card'}).waitFor();s.revealPause=pause;const request=gift.waitForRequest(r=>r.url().endsWith('/receiver/collection')&&r.postDataJSON()?.reveal===true);await gift.getByRole('button',{name:'Open the envelope and reveal the success card'}).click();await request}
  await locker.getByLabel('Inbox options').click();await locker.getByRole('button',{name:'Lock inbox',exact:true}).click();await gift.getByRole('alert').filter({hasText:'Your inbox changed'}).waitFor();release();await gift.waitForLoadState('networkidle');assert.equal(await gift.getByText(MESSAGE,{exact:true}).count(),0);assert.equal(await gift.locator('[data-receiver-view]').count(),0);await c.close()
 }
 const noJs=await browser.newContext({javaScriptEnabled:false}),page=await noJs.newPage();await page.goto(ROOT+'/success-wishes/open');assert(await page.getByLabel('4-digit PIN',{exact:true}).isDisabled());await noJs.close();console.log('No-SMS receiver browser, cross-tab lock and hydration gates passed')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM')})
