import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'

// Same committed SQL and React classroom as the pilot. Test-only identity
// transport is restricted to loopback; no real Supabase project or credentials.
const require=createRequire(import.meta.url)
const testModules='/tmp/live-test/node_modules'
const {build}=require(testModules+'/esbuild')
const {chromium}=require(testModules+'/playwright')
const fixture=await createLiveFixture()
const identity={teacher:fixture.teacher,learner:fixture.a,'learner-b':fixture.b,outsider:fixture.outsider}
const result=await build({
  stdin:{contents:"import React from 'react'; import {createRoot} from 'react-dom/client'; import LiveClassroom from './components/live-classroom/LiveClassroom'; const role=location.pathname.slice(1); createRoot(document.getElementById('root')).render(<LiveClassroom classId={role==='teacher'?'"+fixture.cls+"':null} teacher={role==='teacher'} back='/'/>);",loader:'tsx',resolveDir:process.cwd()},
  bundle:true,write:false,outdir:'out',entryNames:'app',jsx:'automatic',platform:'browser',
  nodePaths:[testModules],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED':'"false"'},
  plugins:[{name:'loopback-fixture',setup(b){
    b.onResolve({filter:/^(@\/lib\/supabase|next\/link)$/},args=>({path:args.path,namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:process.cwd(),contents:args.path==='next/link'?
      "import React from 'react'; export default function Link({children,...props}) {return <a {...props}>{children}</a>}" :
      "const role=location.pathname.slice(1); const ids="+JSON.stringify(identity)+"; export const supabase={from:(name)=>{const root={id:'00000000-0000-4000-8000-000000000060',title:'Live fraction reading',subject:'Mathematics',grade:'Grade 4',asset_kind:'learner_notes',status:'active',visibility:'public'};const version={id:'00000000-0000-4000-8000-000000000061',resource_id:root.id,version:1,payload:{content_text:'One quarter means one of four equal parts.'},lifecycle_status:'certified',rights_status:'cleared',certified_at:'2026-11-21T08:00:00Z'};const scheme={id:'00000000-0000-4000-8000-000000000062',topic:'Fractions',teacher_id:ids.teacher,class_id:'00000000-0000-4000-8000-000000000010'};const link={scheme_lesson_id:scheme.id,resource_id:root.id,resource_version_id:version.id,target_type:'scheme_lesson'};const forbiddenNotes={...root,id:'00000000-0000-4000-8000-000000000063',title:'Private marking scheme',asset_kind:'teacher_notes'};const forbiddenCPA={...root,id:'00000000-0000-4000-8000-000000000064',title:'CPA lesson',grade:'Professional Studies'};const rows=name==='learning_resources'?[root,forbiddenNotes,forbiddenCPA]:name==='learning_resource_versions'?[version]:name==='scheme_of_work'?[scheme]:name==='teaching_resource_links'?[link]:[];const filters=[];const matching=()=>rows.filter(row=>filters.every(fn=>fn(row)));const q={select:()=>q,eq:(key,val)=>{filters.push(row=>row[key]===val);return q},in:(key,values)=>{filters.push(row=>values.includes(row[key]));return q},not:(key,op,val)=>{if(op==='is'&&val===null)filters.push(row=>row[key]!==null&&row[key]!==undefined);return q},is:(key,val)=>{filters.push(row=>row[key]===val);return q},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:matching()[0]??null,error:null}),then:(resolve,reject)=>Promise.resolve({data:matching(),error:null}).then(resolve,reject)};return q},auth:{getUser:async()=>({data:{user:{id:ids[role]}},error:null}),getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,params)=>{try { const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,params})});return await r.json()} catch(e){return {data:null,error:{message:'Connection interrupted'}}}}};"}))
  }}]
})
const assets=new Map(result.outputFiles.map(f=>['/'+f.path.split('/').at(-1),f.contents]))
assert.ok(assets.has('/app.js')&&assets.has('/app.css'),'Actual UI and CSS bundle must exist')
let queue=Promise.resolve()
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname
  if(assets.has(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css'});return res.end(assets.get(path))}
  const role=path.slice(1)
  if(Object.hasOwn(identity,role)&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html','Set-Cookie':'role='+role+'; HttpOnly; SameSite=Strict; Path=/'})
    return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;font-family:system-ui}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
  }
  if(path!=='/rpc'||req.method!=='POST'){res.writeHead(404);return res.end()}
  const userRole=(req.headers.cookie??'').match(/(?:^|;\s*)role=([a-z-]+)(?:;|$)/)?.[1]
  if(!userRole||!Object.hasOwn(identity,userRole)){res.writeHead(403);return res.end()}
  let body='';for await(const part of req){body+=part;if(body.length>300000){res.writeHead(413);return res.end()}}
  const job=async()=>{
    try{
      const {name,params:p}=JSON.parse(body)
      if(name!=='vibe_live_command')throw Error('Unexpected RPC')
      const data=await fixture.rpc(identity[userRole],p.p_action,p.p_session_id,p.p_version,p.p_payload,p.p_class_id)
      return {data,error:null}
    }catch(e){return {data:null,error:{code:e.code,message:e.message}}}
  }
  const done=queue.then(job);queue=done.then(()=>undefined,()=>undefined)
  const response=await done
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(response))
})
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)})
const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true})
const contexts=[],errors=[]
async function open(role,width=360,height=780,resume=''){
  const context=await browser.newContext({viewport:{width,height}})
  contexts.push(context);const page=await context.newPage()
  page.setDefaultTimeout(18000)
  page.on('pageerror',e=>errors.push(role+': '+e.message))
  await page.goto(origin+'/'+role+resume)
  return {page,context}
}
const button=(p,name)=>p.getByRole('button',{name,exact:true})
const dialog=p=>p.getByRole('dialog',{name:'Live classroom'})
async function see(p,text){await p.getByText(text,{exact:true}).first().waitFor({state:'visible'})}
async function noPageOverflow(p){
 const sizes=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth])
 assert.ok(sizes[0]<=sizes[1]+1,'Page overflow: '+sizes.join('/'))
}
async function join(p){await p.getByRole('button',{name:/Browser lesson/}).click();await dialog(p).waitFor()}
try{
 const teacher=await open('teacher',1280,800),t=teacher.page
 await button(t,'My presentations').click()
 await button(t,'New presentation').click()
 await t.getByLabel('Presentation name').fill('Prepared fractions')
 await t.getByLabel('Slide title').fill('Equivalent fractions')
 await t.getByLabel('Content',{exact:true}).fill('Two quarters make one half.')
 await t.getByLabel('Diagram',{exact:true}).selectOption('fraction-bars')
 await t.getByLabel('Presenter notes (private)').fill('Private presenter fixture')
 await button(t,'Save & use').click()
 await t.getByText(/Ready for next lesson: Prepared fractions/).waitFor()
 await t.getByLabel('Lesson title').fill('Browser lesson')
 await button(t,'Go Live').click()
 await dialog(t).waitFor()
 await button(t,'Slides').click()
 await t.getByLabel('Title',{exact:true}).waitFor()
 assert.equal(await t.getByLabel('Title',{exact:true}).inputValue(),'Equivalent fractions')
 await button(t,'Present slide').click()
 const learner=await open('learner'),l=learner.page
 await join(l);await see(l,'Equivalent fractions')
 assert.equal(await l.getByText('Private presenter fixture',{exact:true}).count(),0)
 await noPageOverflow(l);await noPageOverflow(t)
 await button(t,'Edit slides').click()
 await t.getByRole('button',{name:'Add slide'}).click()
 await t.getByLabel('Title',{exact:true}).fill('Three quarters')
 await t.getByLabel('Content',{exact:true}).fill('Three of four equal parts.')
 await button(t,'Present slide').click()
 await see(l,'Three quarters')
 await button(t,'Previous slide').click();await see(l,'Equivalent fractions')
 await button(t,'Next slide').click();await see(l,'Three quarters')
 await t.getByText('Draft saved',{exact:true}).waitFor()
 const sid=new URL(t.url()).searchParams.get('resumeRoom')
 assert.ok(sid)
 const recovered=await open('teacher',360,780,'?resumeRoom='+sid)
 await dialog(recovered.page).waitFor()
 await button(recovered.page,'Slides').click()
 assert.equal(await recovered.page.getByLabel('Title',{exact:true}).inputValue(),'Three quarters')
 await noPageOverflow(recovered.page)
 await recovered.context.close()
 // Resources must display an existing certified payload through the actual
 // Live publish/history path, not through a separate learner data channel.
 await button(t,'Resources').click()
 await t.getByLabel('Search resources').fill('Fractions')
 await t.getByText(/Prepared · Fractions/).waitFor()
 assert.equal(await t.getByText('Private marking scheme',{exact:true}).count(),0)
 assert.equal(await t.getByText('CPA lesson',{exact:true}).count(),0)
 await t.getByRole('button',{name:/Live fraction reading/}).click()
 await button(t,'Present this page').click()
 await l.getByText(/One quarter means one of four equal parts/).waitFor()
 await button(l,'Make reading text bigger').click()
 // The reader presents the approved snapshot without injecting source HTML.
 assert.equal(await l.locator('article').filter({hasText:'One quarter means one of four equal parts.'}).count(),1)
 await l.evaluate(()=>{
   const article=[...document.querySelectorAll('article')].find(el=>el.textContent.includes('One quarter means one of four equal parts.'))
   const element=[...(article?.querySelectorAll('p')??[])].find(p=>p.textContent?.includes('One quarter means one of four equal parts.'))
   if(!element)throw new Error('Missing readable paragraph')
   const selection=window.getSelection(),range=document.createRange()
   range.selectNodeContents(element);selection.removeAllRanges();selection.addRange(range)
 })
 await button(l,'Save selected passage to private notes').click()
 assert.match(await l.getByLabel('Personal notes').inputValue(),/One quarter means one of four equal parts/)
 await button(l,'Save notes').click()
 await l.getByRole('button',{name:'Close',exact:true}).click()

 await button(t,'Resources').click()
 await noPageOverflow(t)
 await button(t,'Return to lesson').click()
 await button(t,'Board').click()
 await t.getByLabel('Board text').fill('2 + 3 = 5')
 await button(t,'Insert text').click()
 await button(t,'Share board').click()
 await l.getByRole('img',{name:'Shared board page 1 of 1'}).waitFor()
 await see(l,'2 + 3 = 5')
 await button(l,'Raise hand').click()
 await see(l,'Hand raised — teacher notified')
 await t.getByRole('button',{name:/^Learners · /}).click()
 await button(t,'Acknowledge hand').click()
 await see(l,'Teacher acknowledged your hand')
 // Teacher starts the private conversation before learner asks anything.
 await button(t,'Message privately').click()
 await t.getByLabel('Private message').fill('Typing to Learner A')
 await l.getByRole('button',{name:/^More/}).click()
 await l.getByRole('button',{name:/^Teacher messages/}).click()
 await see(l,'Teacher is typing…')
 await t.getByLabel('Private message').fill('Can I help you with equivalent fractions?')
 await button(t,'Send privately').click()
 await see(t,'Can I help you with equivalent fractions?')
 await see(l,'Can I help you with equivalent fractions?')
 await see(t,'Read')
 await l.getByLabel('Private message').fill('Yes, please explain the denominator.')
 await button(l,'Send privately').click()
 await see(t,'Yes, please explain the denominator.')
 await see(l,'Read')
 await l.getByRole('button',{name:'Close private conversation'}).click()
 await t.getByRole('button',{name:'Close private conversation'}).click()
 await t.getByRole('button',{name:/^Learners · /}).click()
 await button(l,'Ask privately').click()
 await l.getByLabel('Your question').fill('Please explain the denominator.')
 await button(l,'Send privately').click()
 await see(l,'You → Teacher')
 await see(l,'Sent · Awaiting reply')
 await see(t,'Please explain the denominator.')
 await t.getByLabel('Reply privately').fill('The denominator counts equal parts.')
 await button(t,'Send reply').click()
 await see(l,'Teacher → You')
 await see(l,'The denominator counts equal parts.')
 await see(l,'Sent · Replied')
 await see(t,'You → Learner A')
 await l.getByRole('button',{name:'Close',exact:true}).click()
 await t.getByRole('button',{name:'Close tools'}).click()
 await t.getByRole('button',{name:/^Chat/}).click()
 await button(t,'Enable class chat').click()
 await button(l,'Chat · On').click()
 await l.getByLabel('Message the class').fill('Can we review this publicly?')
 await button(l,'Send to class').click()
 await see(t,'Can we review this publicly?')
 t.once('dialog',d=>void d.accept())
 await button(t,'Hide message').click()
 await l.getByText('Can we review this publicly?',{exact:true}).waitFor({state:'hidden'})
 await l.getByRole('button',{name:'Close class chat'}).click()
 await t.getByRole('button',{name:'Close class chat'}).click()
 await button(l,'Notes').click()
 await l.getByLabel('Personal notes').fill('My private learner note')
 await button(l,'Save notes').click()
 await see(l,'Notes saved privately')
 await l.getByRole('button',{name:'Close',exact:true}).click()
 const second=await open('learner-b',390,844)
 await join(second.page)
 await button(second.page,'Ask').click()
 assert.equal(await second.page.getByText('Please explain the denominator.',{exact:true}).count(),0)
 assert.equal(await second.page.getByText('The denominator counts equal parts.',{exact:true}).count(),0)
 await second.page.getByRole('button',{name:'Close',exact:true}).click()
 await button(second.page,'Notes').click()
 assert.equal(await second.page.getByLabel('Personal notes').inputValue(),'')
 await second.context.close()
 // Separate-user browser must be visible after the auxiliary learner context closes.
 await l.bringToFront()
 assert.equal(await l.evaluate(() => document.visibilityState),'visible','Learner page must be foreground for realtime delivery assertions')
 await button(t,'Quiz').click()
 await t.getByLabel('Question or instruction').fill('How many quarters make one half?')
 await t.getByLabel('Answer (hidden until reveal)').fill('Two quarters')
 await button(t,'Share with class').click()
 await t.getByLabel('Question or instruction').waitFor({state:'hidden'})
 const serverAfterQuiz=await fixture.rpc(fixture.a,'get',sid,null,{},fixture.cls)
 assert.equal(serverAfterQuiz.prompt?.body,'How many quarters make one half?','Teacher quiz must persist after concurrent chat changes the room version')
 assert.equal(serverAfterQuiz.history?.length,7,'Successful quiz must extend the ordered lesson history')
 await l.bringToFront()
 await see(l,'How many quarters make one half?')
 assert.equal(await l.getByText('Two quarters',{exact:true}).count(),0)
 await l.getByLabel('Your answer').fill('2')
 await button(l,'Submit').click()
 await l.getByText(/Submitted:/).waitFor()
 await button(t,'More').click()
 await button(t,'Reveal / close answers').click()
 await see(l,'Two quarters')
 await l.getByRole('button',{name:'First lesson page'}).click()
 await see(l,'Equivalent fractions')
 await button(l,'Return to Live').click()
 await see(l,'How many quarters make one half?')
 await learner.context.setOffline(true)
 await see(l,'How many quarters make one half?')
 await learner.context.setOffline(false)
 await noPageOverflow(l)
 await l.reload();await dialog(l).waitFor();await see(l,'How many quarters make one half?')
 const denied=await open('outsider',360,780,'?resumeRoom='+sid)
 await denied.page.getByRole('alert').waitFor()
 assert.equal(await denied.page.getByRole('dialog',{name:'Live classroom'}).count(),0)
 await denied.context.close()
 await t.getByRole('button',{name:'Close tools'}).click()
 await button(t,'Edit as new question').click()
 assert.equal(await t.getByLabel('Question or instruction').inputValue(),'How many quarters make one half?')
 assert.equal(await t.getByLabel('Answer (hidden until reveal)').inputValue(),'Two quarters')
 await t.getByLabel('Question or instruction').fill('How many quarters make one whole?')
 await t.getByLabel('Answer (hidden until reveal)').fill('Four quarters')
 await button(t,'Share with class').click()
 await see(l,'How many quarters make one whole?')
 assert.equal(await l.getByText('Four quarters',{exact:true}).count(),0)
 await l.getByLabel('Your answer').waitFor()
 await l.getByRole('button',{name:'Previous lesson page'}).click()
 await see(l,'How many quarters make one half?')
 await see(l,'Two quarters')
 await button(l,'Return to Live').click()
 await see(l,'How many quarters make one whole?')
 // Publish a genuinely scrollable teaching document through the same
 // authoritative room. Multiple mobile viewports follow a normalized offset.
 const longText='Live reading guide.\n'+Array.from({length:72},(_,i)=>'Step '+(i+1)+': Read the analogue clock carefully.').join('\n')
 const beforeLong=await fixture.rpc(fixture.teacher,'get',sid,null,{},fixture.cls)
 await fixture.rpc(fixture.teacher,'publish',sid,beforeLong.version,{kind:'teach',body:longText})
 const hostStage=t.getByLabel('Shared lesson',{exact:true})
 const pupilStage=l.getByLabel('Shared lesson',{exact:true})
 await t.getByText(/Live reading guide/).first().waitFor()
 await l.getByText(/Live reading guide/).waitFor()
 await t.getByRole('button',{name:'Previous lesson page'}).click()
 await l.getByText('How many quarters make one whole?',{exact:true}).first().waitFor()
 await t.getByRole('button',{name:'Return to Live'}).click()
 await l.getByText(/Live reading guide/).waitFor()
 await hostStage.evaluate(element=>{
   if(element.scrollHeight<=element.clientHeight+100)throw Error('Teacher reading area must be scrollable')
   element.scrollTop=(element.scrollHeight-element.clientHeight)*0.7
   element.dispatchEvent(new Event('scroll',{bubbles:true}))
 })
 await l.waitForFunction(()=>{
   const element=document.querySelector('[aria-label="Shared lesson"]')
   return element&&element.scrollHeight>element.clientHeight+100&&
     element.scrollTop/(element.scrollHeight-element.clientHeight)>0.5
 },null,{timeout:18000})
 await pupilStage.evaluate(element=>{
   element.dispatchEvent(new WheelEvent('wheel',{deltaY:-150,bubbles:true}))
   element.scrollTop=0
 })
 await l.getByText('Browsing independently',{exact:true}).waitFor()
 await hostStage.evaluate(element=>{
   element.scrollTop=(element.scrollHeight-element.clientHeight)*0.25
   element.dispatchEvent(new Event('scroll',{bubbles:true}))
 })
 // Teacher updates must not hijack a learner who chose independent browsing.
 await l.waitForTimeout(1500)
 assert.equal(await pupilStage.evaluate(element=>element.scrollTop),0)
 await button(l,'Jump to teacher').click()
 await l.waitForFunction(()=>{
   const element=document.querySelector('[aria-label="Shared lesson"]')
   const max=element.scrollHeight-element.clientHeight
   return max>0&&Math.abs(element.scrollTop/max-0.25)<0.14
 },null,{timeout:18000})
 await button(t,'End').click()
 await button(t,'Confirm end').click()
 await see(l,'This session has ended.')
 await l.getByRole('button',{name:'First lesson page'}).click()
 await see(l,'Equivalent fractions')
 assert.deepEqual(errors,[],'Browser runtime errors')
 console.log('PASS: actual responsive classroom UI with synthetic authenticated RPC transport, separate learner views, library reuse, draft recovery, slide navigation, board, private notes, hand acknowledgement, quiz reveal, offline/reconnect, outsider denial and ended history')
}catch(e){
 for(const c of contexts)for(const p of c.pages())console.error(p.url(),(await p.locator('body').innerText().catch(()=>'' )).slice(0,3500))
 throw e
}finally{
 await browser.close();await new Promise(ok=>server.close(ok));await fixture.db.close()
}
