'use strict'
// UI-only synthetic responses. Backend authorization and SQL semantics are tested separately.
const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {spawn}=require('node:child_process')
const ROOT=process.env.SUCCESS_WISHES_QA_ORIGIN||'http://localhost:3096'
const token='a'.repeat(64)
const joe={id:'11111111-1111-4111-8111-111111111111',recipientId:'22222222-2222-4222-8222-222222222222',source:'remembered',candidate:'Joe',school:'Gilgil Township',examYear:'2026',theme:'heritage',sender:'Mum',message:'Joe, believe in yourself. We are cheering you on.',opened:true,expiresAt:new Date(Date.now()+86400000).toISOString()}
const apex={...joe,id:'33333333-3333-4333-8333-333333333333',recipientId:'44444444-4444-4444-8444-444444444444',candidate:'Apex Plaster',theme:'nightfall',sender:'Dad'}
;(async()=>{
 const log=fs.openSync('/tmp/success-wishes-simplification-server.log','w')
 const server=process.env.SUCCESS_WISHES_QA_ORIGIN?null:spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3096'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false'},stdio:['ignore',log,log]})
 if(server){for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Server stopped');try{if((await fetch(ROOT+'/api/success-wishes/config')).ok)break}catch{};if(i===89)throw Error('Server not ready');await new Promise(resolve=>setTimeout(resolve,1000))}}
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 try{
  for(const width of [320,360,390,412,768,1280]){
   const context=await browser.newContext({viewport:{width,height:width<768?740:900}}),page=await context.newPage(),errors=[]
   page.on('pageerror',e=>errors.push(e.message))
   await page.route('**/api/success-wishes/**',async route=>{
    const u=new URL(route.request().url()),path=u.pathname,method=route.request().method()
    const answer=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(path.endsWith('/gift')){assert(['POST','PUT'].includes(method),'Metadata check precedes authorized reveal');return answer({card:method==='PUT'?joe:{...joe,sender:null,message:undefined,opened:false}})}
    if(path.endsWith('/receiver/account'))return answer({error:'Unlock your wishes.'},401)
    if(path.endsWith('/receiver/collection')){if(width!==390)return answer({error:'Unlock your wishes.'},401);if(method==='POST')return answer({card:apex});return answer({recipient:{id:apex.recipientId,name:apex.candidate,school:apex.school},cards:[{...apex,source:'paid'}]})}
    if(path.endsWith('/receiver/remembered')){if(method==='GET')return answer({cards:[joe,apex].map(({message,...c})=>c)});const b=route.request().postDataJSON(),card=b.id===apex.id?apex:joe;assert.equal(typeof b.reveal,'boolean');return answer({card:b.reveal?card:{...card,sender:null,message:undefined,opened:false}})}
    return answer({})
   })
   await page.goto(ROOT+'/success-wishes/gift#token='+token)
   await page.getByTestId('success-card-message-preview').waitFor({state:'visible'})
   await page.locator('[data-book-phase="opened"]').waitFor()
   assert.equal(await page.getByRole('heading',{name:'Keep your wishes'}).count(),0)
   assert.equal(await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).count(),0)
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Gift horizontal overflow at '+width)
   const message=await page.getByTestId('success-card-message-preview').boundingBox();assert(message.y<640,'Message requires scrolling at '+width)
   if(width<768){const book=await page.locator('[data-receiver-view] > div').first().boundingBox();assert(book.y+book.height<670,'Book hidden by bottom navigation at '+width)}
   await page.getByRole('link',{name:'Back to My wishes',exact:true}).click()
   await page.getByRole('region',{name:'Joe collection',exact:true}).waitFor()
   if(width===390){await page.getByRole('heading',{name:'For Apex Plaster',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Apex Plaster collection',exact:true}).count(),0,'Existing PIN collection is not duplicated')}else await page.getByRole('region',{name:'Apex Plaster collection',exact:true}).waitFor()
   assert.equal(await page.getByLabel('Your inbox PIN').count(),0,'PIN interrupts guest inbox')
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Inbox horizontal overflow at '+width)
   if(width===390)await page.getByRole('button',{name:'Read wish from Dad',exact:true}).click();else await page.getByRole('region',{name:'Apex Plaster collection',exact:true}).getByRole('link').click()
   await page.getByRole('heading',{name:'From Dad to Apex Plaster',exact:true}).waitFor()
   await page.getByTestId('success-card-message-preview').waitFor({state:'visible'})
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid=success-card-message-preview]')).opacity==='1')
   assert.equal(errors.length,0,errors.join('\n'))
   if(process.env.SUCCESS_WISHES_QA_SCREENSHOTS){fs.mkdirSync(process.env.SUCCESS_WISHES_QA_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.SUCCESS_WISHES_QA_SCREENSHOTS+'/gift-'+width+'.png',fullPage:true})}
   await context.close();console.log('PASS direct gift, separate collections, returning access, no account interruption, no overflow:',width)
  }
 }finally{await browser.close();server?.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1})
