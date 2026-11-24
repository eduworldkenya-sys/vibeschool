import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'

const require=createRequire(import.meta.url)
const testModules='/tmp/live-test/node_modules'
const {build}=require(testModules+'/esbuild')
const {chromium}=require(testModules+'/playwright')
const roomId='00000000-0000-4000-8000-000000000010'
const learnerId='00000000-0000-4000-8000-000000000030'
const jsx=`import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LiveVoice} from './components/live-classroom/LiveVoice';
const teacher=location.pathname==='/teacher';
const studentId='${learnerId}';
function App(){
  const [learners,setLearners]=useState(location.search.includes('solo=1')?[]:[{studentId,name:'Learner A',needsHelp:true}]);
  return <LiveVoice roomId='${roomId}' classId={null} teacher={teacher} enabled={true}
    status='active' learners={teacher?learners:[]}
    onAcknowledge={async id=>{
      if(id!==studentId)throw Error('Bad learner');
      window.__acks=(window.__acks||0)+1;
      setLearners([{studentId,name:'Learner A',needsHelp:false}])
    }}/>;
}
createRoot(document.getElementById('root')).render(<App/>);`
const fakeAuth=`const role=location.pathname==='/teacher'?'teacher':'learner';
export const supabase={auth:{
  getSession:async()=>({data:{session:{access_token:'fixture-jwt',user:{id:role+'-fixture'}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
const fakeDaily=`
class Call{
  constructor(){this.handlers={};this.destroyed=false;this.isAudio=false;
    this.people={local:{local:true,session_id:'self',user_id:'teacher-fixture',
    tracks:{audio:{persistentTrack:null}},permissions:{canSend:new Set(['audio'])}}};}
  on(name,cb){(this.handlers[name]||=[]).push(cb);return this}
  emit(name,event){for(const cb of this.handlers[name]||[])cb(event)}
  participants(){return this.people}
  async join(options){
    if(!options.token)throw Error('Missing auth token');
    if(location.search.includes('failJoin=1')){
      this.emit('error',{action:'error',errorMsg:'private opaque failure'})
      throw Error('private opaque failure')
    }
    const teacher=location.pathname==='/teacher'
    this.people.local.permissions.canSend=teacher?new Set(['audio']):false
    if(teacher&&!location.search.includes('solo=1'))this.people.remote={local:false,session_id:'other',user_id:'${learnerId}',
      tracks:{audio:{persistentTrack:null}},permissions:{canSend:false}}
    window.__joinCount=(window.__joinCount||0)+1
    this.emit('participant-joined');return this.people
  }
  localAudio(){return this.isAudio}
  setLocalAudio(value){this.isAudio=value;this.emit('participant-updated');return this}
  updateParticipant(sid,change){
    window.__moderations=(window.__moderations||0)+1
    if(sid!=='other')throw Error('Cannot moderate unknown student')
    if(change.updatePermissions)this.people.remote.permissions.canSend=change.updatePermissions.canSend
    if(change.eject)delete this.people.remote
    this.emit('participant-updated');return this
  }
  isDestroyed(){return this.destroyed}
  async destroy(){this.destroyed=true;window.__destroyCount=(window.__destroyCount||0)+1}
}
export default {createCallObject:options=>{const c=new Call();window.__voiceCall=c;window.__voiceOptions=options;return c}};
`
const bundled=await build({
  stdin:{contents:jsx,loader:'tsx',resolveDir:process.cwd()},
  bundle:true,write:false,outdir:'out',entryNames:'app',jsx:'automatic',platform:'browser',
  nodePaths:[testModules],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_VIBE_LIVE_DAILY_ENABLED':'"true"','process.env.NEXT_PUBLIC_VIBE_LIVE_MESH_PILOT_ENABLED':'"false"'},
  plugins:[{name:'voice-browser-fixture',setup(build){
    build.onResolve({filter:/^(@\/lib\/supabase|@daily-co\/daily-js)$/},args=>({path:args.path,namespace:'voice-mock'}))
    build.onLoad({filter:/.*/,namespace:'voice-mock'},args=>({
      loader:'js',contents:args.path==='@/lib/supabase'?fakeAuth:fakeDaily,
    }))
  }}],
})
const files=new Map(bundled.outputFiles.map(x=>['/'+x.path.split('/').at(-1),x.contents]))
assert.ok(files.has('/app.js')&&files.has('/app.css'))
let allowed=true
const diagnostics=[]
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname
  if(files.has(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css'});return res.end(files.get(path))}
  if(path==='/teacher'||path==='/learner'){
    res.writeHead(200,{'Content-Type':'text/html'})
    return res.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"/></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
  }
  if(path==='/api/live/voice/'+roomId&&req.method==='PATCH'){
    const chunks=[]
    for await (const chunk of req)chunks.push(chunk)
    diagnostics.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    res.writeHead(202,{'Content-Type':'application/json'})
    return res.end(JSON.stringify({accepted:true}))
  }
  if(path==='/api/live/voice/'+roomId&&req.method==='POST'){
    if(!allowed){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'You are no longer allowed in this classroom.'}))}
    const teacher=String(req.headers.referer??'').includes('/teacher')
    res.writeHead(200,{'Content-Type':'application/json'})
    return res.end(JSON.stringify({
      url:'https://fixtures.daily.co/vs-live-'+roomId,token:'fixture-token',
      role:teacher?'teacher':'learner',expiresAt:Math.floor(Date.now()/1000)+120,
    }))
  }
  res.writeHead(404);res.end()
})
await new Promise(ok=>server.listen(0,'127.0.0.1',ok))
const base='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true})
const pages=[],errors=[]
async function open(role,clock=false,query=''){
  const context=await browser.newContext({viewport:{width:390,height:760}})
  pages.push(context)
  const page=await context.newPage()
  page.on('pageerror',err=>errors.push(role+': '+err.message))
  if(clock)await page.clock.install()
  await page.goto(base+'/'+role+query)
  return page
}
try{
  // No second participant or learner roster is required for teacher mic.
  const solo=await open('teacher',false,'?solo=1')
  await solo.getByRole('button',{name:'Join audio'}).click()
  await solo.getByRole('status').getByText('Connected').waitFor()
  assert.deepEqual(await solo.evaluate(()=>({
    startAudioOff:window.__voiceOptions.startAudioOff,
    startVideoOff:window.__voiceOptions.startVideoOff,
    videoSource:window.__voiceOptions.videoSource,
  })),{startAudioOff:true,startVideoOff:true,videoSource:false})
  assert.match(await solo.locator('section').textContent(),/Learners on audio: 0/)
  await solo.getByRole('button',{name:'Speak',exact:true}).click()
  assert.equal(await solo.evaluate(()=>window.__voiceCall.localAudio()),true)
  await solo.evaluate(()=>window.__voiceCall.emit('error',{
    error:{type:'connection-error'},
    errorMsg:'untrusted secret opaque value must not display'
  }))
  await solo.getByRole('alert').getByText('Daily audio connection failed. Check network connection and retry.').waitFor()
  // Fatal event telemetry contains only closed enums, not untrusted messages.
  await new Promise(ok=>setTimeout(ok,100))
  assert.equal(diagnostics.length,1)
  assert.deepEqual(diagnostics[0].diagnostic,{stage:'connected',code:'connection-error',hint:'unknown'})
  assert.doesNotMatch(JSON.stringify(diagnostics),/untrusted|secret|meeting token|fixture-jwt/) 
  assert.doesNotMatch(await solo.getByRole('alert').textContent(),/untrusted|secret|token/)
  assert.equal(await solo.getByRole('button',{name:'Join audio'}).isEnabled(),true)
  await solo.getByRole('button',{name:'Join audio'}).click()
  await solo.getByRole('status').getByText('Connected').waitFor()
  await solo.evaluate(()=>window.__voiceCall.emit('error',{
    action:'error',
    errorMsg:'Private meeting token secret leaks at https://example.invalid/private',
  }))
  await solo.getByRole('alert').getByText('Daily audio failed (connected / token). Retry joining.').waitFor()
  await new Promise(ok=>setTimeout(ok,100))
  assert.deepEqual(diagnostics[1].diagnostic,{stage:'connected',code:'unknown',hint:'token'})
  assert.doesNotMatch(JSON.stringify(diagnostics),/https:\/\/example.invalid|Private meeting token secret/)
  await solo.getByRole('button',{name:'Join audio'}).click()
  await solo.getByRole('status').getByText('Connected').waitFor()
  // Reproduce an unknown Daily failure during join: recovery must be
  // actionable and no provider-private text is displayed.
  await solo.evaluate(()=>window.__voiceCall.emit('error',{
    action:'error',errorMsg:'unknown redacted failure detail'
  }))
  await solo.getByRole('alert').getByText('Daily audio failed (connected / unknown). Retry joining.').waitFor()
  await new Promise(ok=>setTimeout(ok,100))
  assert.deepEqual(diagnostics[2].diagnostic,{stage:'connected',code:'unknown',hint:'unknown'})
  assert.doesNotMatch(JSON.stringify(diagnostics),/redacted failure detail/)
  await solo.getByRole('button',{name:'Join audio'}).click()
  await solo.getByRole('status').getByText('Connected').waitFor()
  await solo.getByRole('button',{name:'Leave audio'}).click()
  await solo.getByRole('button',{name:'Join audio'}).waitFor()

  const t=await open('teacher',true)
  await t.getByRole('button',{name:'Join audio'}).click()
  await t.getByRole('status').getByText('Connected').waitFor()
  assert.equal(await t.getByRole('button',{name:'Speak',exact:true}).isEnabled(),true)
  await t.getByRole('button',{name:'Speak',exact:true}).click()
  assert.equal(await t.evaluate(()=>window.__voiceCall.localAudio()),true)
  // A failed microphone permission attempt is reported by Daily as
  // camera-error, not by the fatal connection-error listener.
  await t.evaluate(()=>{
    window.__voiceCall.isAudio=false
    window.__voiceCall.emit('camera-error',{
      error:{type:'permissions'},
      errorMsg:{audioOk:false,errorMsg:'private device detail do not log'}
    })
  })
  await t.getByRole('alert').getByText('Microphone unavailable. Allow microphone access in your browser, then tap Speak again.').waitFor()
  assert.equal(await t.getByRole('button',{name:'Speak',exact:true}).isEnabled(),true)
  assert.equal(await t.evaluate(()=>window.__voiceCall.localAudio()),false)
  await new Promise(ok=>setTimeout(ok,100))
  assert.deepEqual(diagnostics[3].diagnostic,{stage:'connected',code:'device-error',hint:'device'})
  assert.doesNotMatch(JSON.stringify(diagnostics),/private device detail/)
  // Retrying remains a fresh, user-initiated microphone action.
  await t.getByRole('button',{name:'Speak',exact:true}).click()
  assert.equal(await t.evaluate(()=>window.__voiceCall.localAudio()),true)
  await t.getByRole('button',{name:'Allow Learner A to speak'}).click()
  await t.waitForFunction(()=>window.__acks===1)
  assert.deepEqual(await t.evaluate(()=>Array.from(window.__voiceCall.people.remote.permissions.canSend)),['audio'])
  await t.getByRole('button',{name:'End speaking turn'}).click()
  assert.equal(await t.evaluate(()=>window.__voiceCall.people.remote.permissions.canSend),false)
  // Renewing a token requires leave+new server authorization; the teacher's
  // previous explicit microphone consent is restored after reauthorization.
  await t.clock.fastForward(95000)
  await t.waitForFunction(()=>window.__joinCount>=2)
  assert.equal(await t.evaluate(()=>window.__voiceCall.localAudio()),true)
  await t.getByRole('button',{name:'Leave audio'}).click()
  await t.getByRole('button',{name:'Join audio'}).waitFor()
  const l=await open('learner')
  await l.getByRole('button',{name:'Join audio'}).click()
  await l.getByRole('status').getByText('Listening').waitFor()
  assert.equal(await l.getByRole('button',{name:'Muted'}).isDisabled(),true)
  await l.evaluate(()=>{
    window.__voiceCall.people.local.permissions.canSend=new Set(['audio'])
    window.__voiceCall.emit('participant-updated')
  })
  await l.getByRole('button',{name:'Speak',exact:true}).waitFor()
  await l.getByRole('button',{name:'Speak',exact:true}).click()
  assert.equal(await l.evaluate(()=>window.__voiceCall.localAudio()),true)
  await l.evaluate(()=>{
    window.__voiceCall.people.local.permissions.canSend=false
    window.__voiceCall.emit('participant-updated')
  })
  await l.getByRole('button',{name:'Muted'}).waitFor()
  assert.equal(await l.evaluate(()=>window.__voiceCall.localAudio()),false)
  // Reproduce the real Android screenshot: Daily fatal error while still joining.
  // The raw provider message must stay private and the mic must remain off.
  const failedJoin=await open('teacher',false,'?solo=1&failJoin=1')
  await failedJoin.getByRole('button',{name:'Join audio'}).click()
  await failedJoin.getByRole('alert').getByText('Daily audio could not connect. Retry; if it keeps failing, try another network.').waitFor()
  assert.equal(await failedJoin.getByRole('button',{name:'Microphone off'}).isDisabled(),true)
  assert.doesNotMatch(await failedJoin.getByRole('alert').textContent(),/private opaque failure/)
  await new Promise(ok=>setTimeout(ok,100))
  assert.deepEqual(diagnostics.at(-1).diagnostic,{stage:'joining',code:'unknown',hint:'unknown'})
  assert.deepEqual(errors,[])
  // Auth revocation on renewal must not silently restore existing media.
  allowed=false
  await l.getByRole('button',{name:'Leave audio'}).click()
  await l.getByRole('button',{name:'Join audio'}).click()
  await l.getByRole('alert').getByText('You are no longer allowed in this classroom.').waitFor()
  assert.equal(await l.evaluate(()=>window.__voiceCall?.localAudio()),false)
  console.log('Live Voice browser: PASS (consent, grant/revoke, teacher renewal, learner deny, cleanup)')
}finally{
  await Promise.all(pages.map(p=>p.close()))
  await browser.close()
  await new Promise(ok=>server.close(ok))
}
