'use strict'
// Controlled mock-provider browser journey: no real customers, SMS or money.
const assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
execFileSync(process.execPath,['qa/success-wishes/build-receiver-theme.mjs','--check'],{stdio:'inherit'})
const { chromium } = require('playwright')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const PRIVATE_MESSAGE = 'You are capable of wonderful things. Every early morning and every page you studied has brought you here. Take a deep breath, trust your preparation and give each question your best. We believe in you, and we are proud of the person you are becoming.'
const screenshots = path.join(os.tmpdir(),'success-wishes-artifacts')
fs.mkdirSync(screenshots,{recursive:true})
const PORT = 3093
const ROOT = 'http://localhost:' + PORT
const CARD_A = '11111111-1111-4111-8111-111111111111'
const CARD_B = '22222222-2222-4222-8222-222222222222'
const CHALLENGE = '33333333-3333-4333-8333-333333333333'
const serverLog = fs.openSync(path.join(os.tmpdir(),'success-wishes-receiver-browser.log'),'w')
const serverEnv={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false',
    SUCCESS_WISHES_RECEIVER_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}
// Dev CSS does not exercise Next's production minifier. The original receiver
// passed dev journeys while production collapsed nested utilities onto its root.
execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{
  env:serverEnv,stdio:['ignore',serverLog,serverLog],timeout:600000,
})
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(PORT)],{
  env:serverEnv,
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
function setupMocks(page, existing) {
  const state=existing||{verified:false,opened:false,verifiedCalls:0,wrongCardReveals:0}
  const card=(id)=>({id,candidate:'Synthetic Candidate',school:'Synthetic School',examYear:'2026',
    theme:id===CARD_A?(state.theme||'heritage'):'nightfall',sender:id===CARD_A?null:'Aunt',
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
          if(state.revealPause)await state.revealPause
          state.opened=true
          payload={card:{...card(data.cardId),consentRequired:false,opened:true,
            sender:data.cardId===CARD_A?'Mum':'Aunt',message:PRIVATE_MESSAGE}}
        }
      }else payload={ok:true}
    } else if(url.pathname.endsWith('/verify')){
      if(method==='POST')payload={challengeId:CHALLENGE,consentRole:'guardian',expiresInSeconds:300}
      else if(method==='PATCH'){
        state.verifiedCalls++
        if(data.cardId!==CARD_A || data.code!=='123456' || !data.consentAcknowledged || data.consentRole!=='guardian'){
          status=401;payload={error:'Guardian approval missing.'}
        }else{state.verified=true;payload={ok:true,recoveryCode:'R8@K2!',inboxUrl:'/success-wishes/inbox'}}
      }
    } else if(url.pathname.endsWith('/inbox')){
      if(method==='GET')payload={recipient:{name:'Synthetic Candidate',school:'Synthetic School'},
        count:2,unopened:1,cards:[
          {id:CARD_A,theme:state.theme||'heritage',sender:state.opened?'Mum':null,opened:state.opened,createdAt:'2026-10-26T08:00:00.000Z'},
          {id:CARD_B,theme:'nightfall',sender:'Aunt',opened:true,createdAt:'2026-10-25T08:00:00.000Z'},
        ]}
      else if(method==='POST')payload={ok:true,url:'/success-wishes/invitation?card='+data.cardId}
      else if(method==='DELETE' && state.logoutFailure){status=503;payload={error:'Synthetic revocation outage'}}
      else payload={ok:true}
    } else if(url.pathname.endsWith('/recover')){
      if(method==='POST')payload={challengeId:CHALLENGE,expiresInSeconds:300}
      else if(method==='PATCH'){status=data.code==='123456'?200:401;payload=status===200?{ok:true,inboxUrl:'/success-wishes/inbox'}:{error:'Incorrect or expired code'}}
    } else {status=404;payload={error:'Unknown controlled route'}}
    await route.fulfill({status:status===200?200:status,contentType:'application/json',
      headers:{'Cache-Control':'no-store'},body:JSON.stringify(payload)})
  })
  return state
}
async function assertNoOverflow(page,label){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,
    label+' must not overflow horizontally')
  assert.equal(await page.locator('main').evaluate(el=>getComputedStyle(el.parentElement).backgroundColor),'rgb(10, 13, 20)',label+' uses the sender dark palette')
}
async function run() {
  await ready()
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||chromium.executablePath()})
  for(const width of [320,390,560,1280]){
    const context=await browser.newContext({viewport:{width,height:840},reducedMotion:'no-preference'})
    const page=await context.newPage();page.setDefaultTimeout(20000)
    setupMocks(page)
    await page.goto(ROOT+'/success-wishes/open',{waitUntil:'networkidle'})
    assert.equal(await page.locator('.receiver-brand img[src*="vibeschool-wordmark-dark.svg"]').count() > 0, true, 'Official VibeSchool wordmark appears in receiver shell')
    if(width<768){
      await page.getByRole('button',{name:'Open receiver menu',exact:true}).first().click()
      const drawer=page.getByRole('dialog',{name:'Receiver navigation menu'})
      await drawer.waitFor({state:'visible'})
      assert.equal(await drawer.locator('.receiver-summary').count(),0,'Empty duplicate collection summary is absent')
      assert.equal(await drawer.getByText('Audio Chimes',{exact:true}).count(),0,'Audio control is not duplicated in drawer')
      assert.equal(await drawer.getByRole('link',{name:'Send a wish'}).count(),1,'Send action remains in receiver navigation')
      const aligned=await drawer.evaluate(el=>{
        const brand=el.querySelector('.receiver-drawer-heading .receiver-brand')?.getBoundingClientRect()
        const close=el.querySelector('.receiver-drawer-heading button')?.getBoundingClientRect()
        const panel=el.querySelector(':scope > div')?.getBoundingClientRect()
        return Boolean(brand&&close&&panel&&brand.right <= close.left + 1&&close.right <= panel.right + 1&&brand.left >= panel.left - 1)
      })
      assert.equal(aligned,true,'Close button and brand occupy separate visible space')
      await drawer.getByRole('button',{name:'Close receiver menu'}).click()
      await drawer.waitFor({state:'hidden'})
    }
    assert.deepEqual(await page.locator('.receiver-theme').evaluate(el=>{
      const style=getComputedStyle(el)
      return {pointer:style.pointerEvents,animation:style.animationName,transform:style.transform}
    }),{pointer:'auto',animation:'none',transform:'none'},'Receiver root must remain tappable and stationary in minified production CSS')
    await page.getByRole('textbox',{name:'Card Access Code',exact:true}).fill('TEST-INVALID-CODE')
    await page.getByRole('button',{name:'Open my wish',exact:true}).click()
    await page.getByRole('alert').filter({hasText:'This card link or access code is invalid.'}).waitFor()
    await page.getByRole('link',{name:'View sample inbox',exact:true}).click()
    await page.getByRole('heading',{name:'Your little collection of joy.'}).waitFor()
    await context.close()
  }
  let themeIndex=0
  for(const width of [320,360,390,412,768,1280]){
    const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'})
    const page=await ctx.newPage();page.setDefaultTimeout(20000)
    page.on('pageerror', error=>console.error('Receiver page error:',error.message))
    const state=setupMocks(page)
    state.theme=['heritage','botanical','nightfall','sunrise'][themeIndex++%4]
    await page.goto(ROOT+'/success-wishes/invitation#token='+'a'.repeat(64),{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'A little joy, just for you.'}).waitFor()
    await page.getByText('Sealed with encouragement',{exact:true}).waitFor()
    assert(!page.url().includes('#token='),'Access secret must leave browser address after accepted claim')
    assert.match(page.url(),/\?card=11111111/)
    assert.equal(await page.getByRole('button',{name:/Open the envelope/}).count(),0,
      'Pending consent cannot interactively reveal the envelope')
    await assertNoOverflow(page,'sealed card at '+width)
    await page.screenshot({path:path.join(screenshots,`receiver-sealed-${width}.png`),fullPage:true})
    assert((await page.getByText('Sealed with encouragement',{exact:true}).boundingBox()).y<600,'The gift is visible on arrival')
    await page.getByRole('link',{name:'Verify & open my gift'}).click()
    await page.getByRole('button',{name:'Send my code'}).click()
    await page.getByText('Your guardian must enter the six-digit SMS code from their registered phone. Valid for five minutes.').waitFor()
    await page.getByRole('textbox',{name:'SMS verification code'}).fill('123456')
    await page.getByRole('checkbox',{name:/I confirm I am the authorised/}).check()
    await page.getByRole('button',{name:'Verify & open inbox'}).click()
    await page.getByRole('heading',{name:'Your private inbox is ready'}).waitFor()
    assert.equal(state.verified,true,'Guardian approval must be completed')
    await assertNoOverflow(page,'guardian verification at '+width)
    await page.getByRole('link',{name:'Open my inbox'}).click()
    await page.getByRole('heading',{name:'My wishes'}).waitFor()
    // Heading renders before the async inbox GET finishes; count() alone races hydration.
    // Wait for the server-backed cards, not only the static page heading.
    await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Open"][aria-label$="private wish"]').length===2)
    assert.equal(await page.locator('button[aria-label^="Open"][aria-label$="private wish"]').count(),2,'Two gifts share one inbox')
    await assertNoOverflow(page,'two-gift inbox at '+width)
    assert.equal(await page.locator('.receiver-bottom:visible').count(),width<768?1:0,'Exactly one mobile bottom bar')
    if (width < 768) {
      assert.equal(await page.locator('.receiver-bottom').getByText('My wishes',{exact:true}).count(),1,'Bottom navigation uses familiar wishes label')
      assert.equal(await page.locator('.receiver-bottom').getByText('Open',{exact:true}).count(),1,'Bottom navigation uses familiar opening label')
    }
    assert.equal(await page.locator('.receiver-sidebar:visible').count(),width>=768?1:0,'Desktop sidebar follows breakpoint')
    assert.match(await page.locator('.receiver-theme').evaluate(el=>getComputedStyle(el).fontFamily),/Receiver Plus Jakarta Sans/,'Reference font is applied')
    if(width<768){
      await page.getByRole('button',{name:'Open receiver menu',exact:true}).first().click()
      await page.getByRole('dialog',{name:'Receiver navigation menu'}).waitFor({state:'visible'})
      await page.keyboard.press('Escape')
      await page.getByRole('dialog',{name:'Receiver navigation menu'}).waitFor({state:'hidden'})
    }
    await page.getByRole('textbox',{name:'Search wishes by sender or theme'}).fill('no-such-sender')
    await page.getByRole('heading',{name:'No matching wishes'}).waitFor()
    await page.getByRole('textbox',{name:'Search wishes by sender or theme'}).fill('')

    await page.screenshot({path:path.join(screenshots,`receiver-inbox-${width}.png`),fullPage:true})
    const gifts=page.locator('button[aria-label^="Open"][aria-label$="private wish"]')
    await gifts.first().click()
    await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).click()
    await page.getByText(PRIVATE_MESSAGE).first().waitFor({state:'visible'})
    await page.getByRole('button',{name:'Close the book card'}).waitFor()
    assert.equal(await page.locator('[data-receiver-view]').getAttribute('data-theme'),state.theme,'Recipient retains the sender theme')
    const expectedPalette={heritage:'#fbf2d0',botanical:'#f3f2e9',nightfall:'#314a75',sunrise:'#ffe9bc'}
    assert.equal(await page.locator('[data-receiver-view]').evaluate(el=>getComputedStyle(el).getPropertyValue('--book-top').trim()),expectedPalette[state.theme],'Receiver uses the canonical sender palette')
    if(width<=640){
      const message=page.getByText(PRIVATE_MESSAGE,{exact:true})
      assert(await message.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Receiver message must not be cropped into a tiny mobile scroll area')
    }
    await page.screenshot({path:path.join(screenshots,`receiver-opened-${width}.png`),fullPage:true})
    assert.equal(state.opened,true,'Paid reveal endpoint was called')
    assert.equal(state.wrongCardReveals,0,'Card ID must stay pinned')
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('button',{name:'Open the envelope and reveal the success card'}).waitFor()
    await assertNoOverflow(page,'refreshed gift at '+width)
    await page.goto(ROOT+'/success-wishes/recover',{waitUntil:'networkidle'})
    const recoveryPhone=page.getByRole('textbox',{name:'Registered Kenyan phone number'})
    const recoverySend=page.getByRole('button',{name:'Send my code'})
    assert.equal(await recoverySend.isDisabled(),true,'Recovery requires a valid registered phone')
    assert.equal(await page.getByRole('textbox',{name:'Student recovery code'}).count(),0,'No backup code required for normal SMS recovery')
    await recoveryPhone.fill('0712345678')
    assert.equal(await recoverySend.isEnabled(),true,'Phone alone enables SMS verification')
    const recoveryPost=page.waitForResponse(response=>response.url().endsWith('/api/success-wishes/receiver/recover')&&response.request().method()==='POST')
    await recoverySend.click()
    const sentRequest=await recoveryPost
    assert.equal(sentRequest.status(),200,'Recovery uses the client API, never a native GET navigation')
    assert.equal(sentRequest.request().postDataJSON().recoveryCode,undefined,'Normal recovery never sends a backup code')
    await page.getByRole('textbox',{name:'SMS verification code'}).fill('000000')
    await page.getByRole('button',{name:'Open my inbox'}).click()
    await page.getByRole('alert').filter({hasText:'Incorrect or expired code'}).waitFor()
    assert.match(page.url(),/\/recover$/)
    await page.getByRole('textbox',{name:'SMS verification code'}).fill('123456')
    await page.getByRole('button',{name:'Open my inbox'}).click()
    await page.getByRole('heading',{name:'My wishes'}).waitFor()
    await assertNoOverflow(page,'recovered inbox at '+width)
    if(width===320){
      await page.goto(ROOT+'/success-wishes/recover',{waitUntil:'networkidle'})
      await page.getByRole('textbox',{name:'Registered Kenyan phone number'}).fill('0712345678')
      await page.getByRole('button',{name:'Use a recovery code instead'}).click()
      const backup=page.getByRole('textbox',{name:'Student recovery code'})
      await backup.fill('5tt')
      assert.equal(await page.getByRole('button',{name:'Send my code'}).isDisabled(),true,'Invalid backup code is blocked')
      await backup.fill('R8@K2!')
      assert.equal(await page.getByRole('button',{name:'Send my code'}).isEnabled(),true,'Existing recovery codes remain available for shared numbers')
      await page.getByRole('button',{name:'Use SMS only'}).click()
      assert.equal(await backup.count(),0,'Switching back hides the optional backup code')
      assert.equal(await page.getByRole('button',{name:'Send my code'}).isEnabled(),true)
    }
    console.log('Receiver controlled browser pass:',width)
    await ctx.close()
  }
  // Reproduce the pre-hydration boundary deterministically without timing guesses.
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:840}})
  const unready=await noJs.newPage()
  await unready.goto(ROOT+'/success-wishes/recover',{waitUntil:'domcontentloaded'})
  assert.equal(await unready.getByRole('textbox',{name:'Registered Kenyan phone number'}).isDisabled(),true,'Recovery must not accept input before handlers attach')
  assert.equal(await unready.getByRole('button',{name:'Send my code'}).isDisabled(),true,'An unhydrated recovery form cannot submit a native GET')
  await noJs.close()
  console.log('Receiver controlled browser pass: pre-hydration recovery guard')
  // A slow reveal must never repopulate private content after sign-out.
  const ctx=await browser.newContext({viewport:{width:390,height:840},reducedMotion:'reduce'})
  const first=await ctx.newPage(),second=await ctx.newPage()
  const state=setupMocks(first);state.verified=true
  setupMocks(second,state)
  await first.goto(ROOT+'/success-wishes/invitation?card='+CARD_A,{waitUntil:'networkidle'})
  await second.goto(ROOT+'/success-wishes/invitation?card='+CARD_A,{waitUntil:'networkidle'})
  let release;state.revealPause=new Promise(resolve=>{release=resolve})
  await first.getByRole('button',{name:'Open the envelope and reveal the success card'}).click()
  await first.getByText('Privacy & help',{exact:true}).click()
  await first.getByRole('button',{name:'Sign out',exact:true}).click()
  await first.getByText('You are signed out. Use your private invitation again to open this wish.').waitFor()
  await second.waitForURL('**/success-wishes/open?notice=device-cleared')
  const lateResponse=first.waitForResponse(r=>r.url().endsWith('/receiver/card')&&r.request().method()==='PUT')
  release();state.revealPause=null
  await (await lateResponse).finished()
  await first.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  await first.getByText('You are signed out. Use your private invitation again to open this wish.').waitFor()
  assert.equal(await first.getByText(PRIVATE_MESSAGE).count(),0)
  console.log('Receiver controlled browser pass: delayed reveal + logout + second-tab purge')
  await ctx.close()
  const logoutContext=await browser.newContext({viewport:{width:1280,height:840}})
  const logoutPage=await logoutContext.newPage()
  const logoutState=setupMocks(logoutPage);logoutState.verified=true;logoutState.logoutFailure=true
  await logoutPage.goto(ROOT+'/success-wishes/inbox',{waitUntil:'networkidle'})
  await logoutPage.locator('button[aria-label$="private wish"]').first().waitFor()
  await logoutPage.locator('.receiver-sidebar').getByRole('button',{name:'Sign out',exact:true}).click()
  await logoutPage.getByRole('alert').filter({hasText:'Sign-out could not be confirmed'}).waitFor()
  assert.equal(await logoutPage.getByText('Aunt',{exact:true}).count(),0,'Failed server sign-out must not leave private inbox contents visible')
  await logoutPage.getByText('This device has been cleared.',{exact:true}).waitFor()
  await logoutContext.close()
  console.log('Receiver controlled browser pass: sidebar sign-out outage clears private content')

}
run().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
  await browser?.close()
  server.kill('SIGTERM')
  fs.closeSync(serverLog)
})
