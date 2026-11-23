import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync('lib/live/voice.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {LiveVoiceError,validateVoiceRoom,voiceUuid,requireLiveVoiceAccessUser,issueLiveVoiceToken,closeLiveVoiceRoom,dailyVoiceName,rejectDailyResponse}=
  await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const id='00000000-0000-4000-8000-000000000010'
const actor='00000000-0000-4000-8000-000000000001'
const learner='00000000-0000-4000-8000-000000000030'
const now=Date.parse('2026-11-21T13:00:00.000Z')
const exp=Math.floor(now/1000)+1200
const teacherRoom={id,title:'Grade 4',mode:'school',teacher:true,status:'active',expiresAt:new Date(exp*1000).toISOString()}
const learnerRoom={...teacherRoom,teacher:false}
const name=dailyVoiceName(id)
const roomInfo={name,url:'https://education.daily.co/'+name,privacy:'private',config:{
  exp,eject_at_room_exp:true,max_participants:2,enforce_unique_user_ids:true,
  enable_knocking:false,enable_screenshare:false,enable_chat:false,
  start_audio_off:true,start_video_off:true,enable_prejoin_ui:false,
}}
function response(status,body){return {status,ok:status>=200&&status<300,json:async()=>body}}
function mockProvider({existing=true,override=null,token='signed-token',roomName=name}={}){
  const calls=[]
  const request=async(url,options)=>{
    const path=url.replace('https://api.daily.co/v1/','')
    const body=options.body?JSON.parse(options.body):null
    calls.push({path,method:options.method,body,headers:options.headers})
    if (path==='rooms/'+roomName && options.method==='GET')return response(existing?200:404,override??roomInfo)
    if (path==='rooms' && options.method==='POST')return response(200,override??roomInfo)
    if (path==='meeting-tokens')return response(200,{token})
    if (path==='rooms/'+roomName && options.method==='DELETE')return response(200,{})
    return response(500,{})
  }
  return {request,calls}
}

test('pilot fails closed outside two authenticated accounts, before token issuance',()=>{
  const teacher='00000000-0000-4000-8000-000000000001'
  const pupil='00000000-0000-4000-8000-000000000030'
  const outsider='00000000-0000-4000-8000-000000000099'
  const cutoff=new Date(now+3600000).toISOString()
  const permitted=teacher+','+pupil
  assert.doesNotThrow(()=>requireLiveVoiceAccessUser(teacher,'pilot',permitted,cutoff,now))
  assert.doesNotThrow(()=>requireLiveVoiceAccessUser(pupil,'pilot',permitted,cutoff,now))
  assert.throws(()=>requireLiveVoiceAccessUser(outsider,'pilot',permitted,cutoff,now),e=>e instanceof LiveVoiceError&&e.status===403)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,'pilot',undefined,cutoff,now),e=>e instanceof LiveVoiceError&&e.status===403)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,'pilot',permitted+',invalid',cutoff,now),e=>e instanceof LiveVoiceError&&e.status===403)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,'public',permitted,cutoff,now),e=>e instanceof LiveVoiceError&&e.status===503)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,undefined,permitted,cutoff,now),e=>e instanceof LiveVoiceError&&e.status===503)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,'pilot',permitted,undefined,now),e=>e instanceof LiveVoiceError&&e.status===503)
  assert.throws(()=>requireLiveVoiceAccessUser(teacher,'pilot',permitted,cutoff,now+3600000),e=>e instanceof LiveVoiceError&&e.status===503)
  assert.doesNotThrow(()=>requireLiveVoiceAccessUser(teacher,'pilot',permitted,cutoff,now+3600000,true),'authorized teacher can clean up after expiry')
  assert.throws(()=>requireLiveVoiceAccessUser(outsider,'pilot',permitted,cutoff,now,true),/limited to pilot accounts/)
})
test('all-account scope admits authenticated UUIDs but remains deny-by-default when unconfigured',()=>{
  const outsider='00000000-0000-4000-8000-000000000099'
  assert.equal(requireLiveVoiceAccessUser(actor,'all',undefined,undefined,now),'all')
  assert.equal(requireLiveVoiceAccessUser(learner,'all','invalid',undefined,now),'all')
  assert.equal(requireLiveVoiceAccessUser(outsider,'all',undefined,undefined,now),'all')
  assert.throws(()=>requireLiveVoiceAccessUser('not-uuid','all',undefined,undefined,now),/Unverified/)
  assert.throws(()=>requireLiveVoiceAccessUser(actor,'everyone',undefined,undefined,now),/not commissioned/)
  assert.throws(()=>requireLiveVoiceAccessUser(actor,'',undefined,undefined,now),/not commissioned/)
  // Granting classroom admission still requires the independently checked
  // RPC and student identity in the route, never this access-scope function.
})
test('reject incorrect and expired classroom authority before any provider request',async()=>{
  assert.equal(voiceUuid(id),true)
  assert.equal(voiceUuid('not-a-uuid'),false)
  for(const value of [null,{...teacherRoom,id:actor},{...teacherRoom,status:'paused'},
    {...teacherRoom,status:'ended'},{...teacherRoom,expiresAt:new Date(now-1000).toISOString()},
    {...teacherRoom,teacher:'true'}, {...teacherRoom,mode:'outside'},
  ]){
    assert.throws(()=>validateVoiceRoom(value,id,now),LiveVoiceError)
  }
  const provider=mockProvider()
  await assert.rejects(issueLiveVoiceToken(learnerRoom,actor,null,'key',provider.request,now),/Unverified participant/)
  await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'',provider.request,now),/not configured/)
  assert.equal(provider.calls.length,0)
})
test('teacher gets bounded audio-only moderation; learner can only receive',async()=>{
  const provider=mockProvider()
  const teacher=await issueLiveVoiceToken(teacherRoom,actor,null,'key',provider.request,now)
  assert.deepEqual(teacher,{url:roomInfo.url,token:'signed-token',role:'teacher',participantId:actor,expiresAt:Math.floor(now/1000)+120})
  const tokenRequest=provider.calls.find(c=>c.path==='meeting-tokens').body.properties
  assert.equal(tokenRequest.is_owner,false)
  assert.deepEqual(tokenRequest.permissions.canSend,['audio'],'Daily JS calls the microphone track audio')
  assert.deepEqual(tokenRequest.permissions.canAdmin,['participants'])
  assert.equal(tokenRequest.enable_recording,undefined,'Daily meeting tokens must not send unsupported recording mode')
  assert.equal(tokenRequest.enable_screenshare,false)
  assert.equal(tokenRequest.start_video_off,true)
  assert.equal(tokenRequest.start_audio_off,true)
  assert.equal(tokenRequest.exp,Math.floor(now/1000)+120)
  assert.equal(tokenRequest.eject_at_token_exp,true,'Media server must eject an already connected participant at expiry')
  assert.equal(tokenRequest.permissions.canReceive.base.video,false)
  assert.equal(tokenRequest.permissions.canReceive.base.screenVideo,false)
  const guest=mockProvider()
  const result=await issueLiveVoiceToken(learnerRoom,actor,learner,'key',guest.request,now)
  assert.equal(result.role,'learner')
  assert.equal(result.participantId,learner)
  const learnerToken=guest.calls.find(c=>c.path==='meeting-tokens').body.properties
  assert.equal(learnerToken.is_owner,false)
  assert.equal(learnerToken.eject_at_token_exp,true,'Learner must be expelled even without an online teacher')
  assert.equal(learnerToken.permissions.canSend,false)
  assert.equal(learnerToken.permissions.canAdmin,false)
  assert.equal(learnerToken.user_id,learner)
})
test('token expires and ejects at room deadline, not after',async()=>{
  const shortRoom={...teacherRoom,expiresAt:new Date(now+65000).toISOString()}
  const provider=mockProvider({override:{...roomInfo,config:{...roomInfo.config,exp:Math.floor(now/1000)+65}}})
  const result=await issueLiveVoiceToken(shortRoom,actor,null,'key',provider.request,now)
  const tokenRequest=provider.calls.find(c=>c.path==='meeting-tokens').body.properties
  assert.equal(result.expiresAt,Math.floor(now/1000)+65)
  assert.equal(tokenRequest.exp,Math.floor(now/1000)+65)
  assert.equal(tokenRequest.eject_at_token_exp,true)
})
test('creates only a locked private audio room, rejects mismatched provider room',async()=>{
  const fresh=mockProvider({existing:false})
  await issueLiveVoiceToken(teacherRoom,actor,null,'key',fresh.request,now)
  const create=fresh.calls.find(c=>c.path==='rooms').body
  assert.equal(create.privacy,'private')
  assert.equal(create.name,name)
  assert.equal(create.properties.eject_at_room_exp,true)
  assert.equal(create.properties.enforce_unique_user_ids,true)
  assert.equal(create.properties.max_participants,2,'two account pilot never requests unsupported 80-person capacity')
  assert.equal(create.properties.start_audio_off,true)
  assert.equal(create.properties.start_video_off,true)
  assert.equal(create.properties.enable_recording,undefined,'Daily room must not send unsupported recording mode')
  assert.equal(create.properties.enable_screenshare,false)
  assert.equal(create.properties.start_audio_off,true)
  assert.equal(create.properties.start_video_off,true)
  for(const data of [
    {...roomInfo,privacy:'public'},
    {...roomInfo,name:'vs-other'},
    {...roomInfo,config:{...roomInfo.config,enable_recording:'cloud'}},
    {...roomInfo,config:{...roomInfo.config,max_participants:80}},
    {...roomInfo,config:{...roomInfo.config,max_participants:100}},
    {...roomInfo,config:{...roomInfo.config,eject_at_room_exp:false}},
    {...roomInfo,config:{...roomInfo.config,enable_screenshare:true}},
    {...roomInfo,config:{...roomInfo.config,start_audio_off:false}},
  ]){
    const p=mockProvider({override:data})
    await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'key',p.request,now),/privacy verification/)
    assert.equal(p.calls.filter(c=>c.path==='meeting-tokens').length,0)
  }
})
test('full-class scope creates a separate private room without a two-seat cap',async()=>{
  const fullName=dailyVoiceName(id,'all')
  const {max_participants:ignored,...fullConfig}=roomInfo.config
  const fullInfo={...roomInfo,name:fullName,url:'https://education.daily.co/'+fullName,config:fullConfig}
  const p=mockProvider({existing:false,override:fullInfo,roomName:fullName})
  const teacher=await issueLiveVoiceToken(teacherRoom,actor,null,'key',p.request,now,'all')
  assert.equal(teacher.url,fullInfo.url)
  assert.deepEqual(p.calls.map(c=>c.path),['rooms/'+fullName,'rooms','meeting-tokens'])
  const create=p.calls.find(c=>c.path==='rooms').body
  assert.equal(create.name,fullName)
  assert.equal(create.privacy,'private')
  assert.equal(Object.hasOwn(create.properties,'max_participants'),false)
  assert.equal(create.properties.start_video_off,true)
  assert.equal(create.properties.enable_chat,false)
  assert.equal(create.properties.enable_screenshare,false)
  const token=p.calls.find(c=>c.path==='meeting-tokens').body.properties
  assert.equal(token.room_name,fullName)
  assert.deepEqual(token.permissions.canSend,['audio'])
  assert.equal(token.eject_at_token_exp,true)
  const learnerProvider=mockProvider({roomName:fullName,override:fullInfo})
  await issueLiveVoiceToken(learnerRoom,actor,learner,'key',learnerProvider.request,now,'all')
  const learnerToken=learnerProvider.calls.find(c=>c.path==='meeting-tokens').body.properties
  assert.equal(learnerToken.permissions.canSend,false)
  assert.equal(learnerToken.permissions.canAdmin,false)
  for(const broken of [
    {...fullInfo,privacy:'public'},
    {...fullInfo,url:roomInfo.url},
    {...fullInfo,config:{...fullConfig,max_participants:2}},
    {...fullInfo,config:{...fullConfig,enable_chat:true}},
    {...fullInfo,config:{...fullConfig,enable_screenshare:true}},
    {...fullInfo,config:{...fullConfig,enable_recording:'cloud'}},
  ]){
    const bad=mockProvider({roomName:fullName,override:broken})
    await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'key',bad.request,now,'all'),/privacy verification/)
    assert.equal(bad.calls.some(c=>c.path==='meeting-tokens'),false)
  }
})
test('Daily room creation 400 is not treated as a racing conflict, and failure is actionable',async()=>{
  const calls=[]
  const request=async(url,options)=>{
    const path=url.replace('https://api.daily.co/v1/','')
    calls.push(path)
    if(path.startsWith('rooms/')&&options.method==='GET')return response(404,{})
    if(path==='rooms'&&options.method==='POST')return response(400,{error:'invalid-request-error'})
    throw Error('unexpected provider retry')
  }
  const logs=[],original=console.error
  try{
    console.error=(...args)=>logs.push(args)
    await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'secret-must-not-log',request,now),
      /Daily rejected the classroom audio settings/)
  }finally{console.error=original}
  assert.deepEqual(calls,['rooms/'+name,'rooms'],'do not make a second GET after invalid room create')
  assert.equal(logs.length,1)
  assert.equal(logs[0][0],'vibeschool_live_voice_daily_failure')
  assert.deepEqual(logs[0][1],{stage:'room-create',status:400,code:'invalid-request-error',field:'unspecified',category:'unspecified'})
  assert.doesNotMatch(JSON.stringify(logs),/secret-must-not-log|signed-token/)
})
test('Daily auth failures and rate limits are correctly distinguished without leaking provider responses',async()=>{
  for (const [status,expected] of [[401,/account authorization failed/],[403,/account authorization failed/],
    [429,/temporarily limited/],[503,/service did not start/]]){
    const calls=[]
    const request=async(url,options)=>{
      calls.push(url)
      return response(status,{info:'untrusted provider text: secret'})
    }
    const logs=[],previous=console.error
    try{
      console.error=(...args)=>logs.push(args)
      await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'private-value',request,now),expected)
    }finally{console.error=previous}
    assert.equal(calls.length,1,'failed room lookup must not create room or request token')
    assert.equal(logs[0][1].stage,'room-lookup')
    assert.equal(logs[0][1].status,status)
    assert.equal(logs[0][1].field,'unspecified')
    assert.equal(logs[0][1].category,'unspecified')
    assert.doesNotMatch(JSON.stringify(logs),/secret|private-value/)
  }
})
test('Daily error diagnostics identify rejected field but never print untrusted provider text',async()=>{
  const logs=[],previous=console.error
  try{
    console.error=(...args)=>logs.push(args)
    await assert.rejects(rejectDailyResponse('room-create',response(400,{
      error:'invalid-request-error',
      info:'Invalid properties.max_participants. private-key=should-never-appear https://example.invalid/secret',
      auth:'also-never-log'
    })),/Daily rejected/)
    assert.deepEqual(logs[0],[ 'vibeschool_live_voice_daily_failure', {
      stage:'room-create',status:400,code:'invalid-request-error',field:'max_participants',category:'invalid_setting'
    }])
    assert.doesNotMatch(JSON.stringify(logs),/should-never-appear|example.invalid|also-never-log/)
    logs.length=0
    await assert.rejects(rejectDailyResponse('room-create',response(400,{
      error:'invalid-request-error',info:'The maximum number of rooms on your plan has been reached'
    })),/Daily rejected/)
    assert.equal(logs[0][1].category,'quota_or_plan')
    assert.equal(logs[0][1].field,'unspecified')
  }finally{console.error=previous}
})
test('teacher can terminate exact media room on canonical class end',async()=>{
  const p=mockProvider()
  await closeLiveVoiceRoom(id,'key',p.request)
  assert.equal(p.calls.length,1)
  assert.equal(p.calls[0].method,'DELETE')
  assert.equal(p.calls[0].path,'rooms/'+name)
  const group=mockProvider({roomName:dailyVoiceName(id,'all')})
  await closeLiveVoiceRoom(id,'key',group.request,'all')
  assert.equal(group.calls[0].path,'rooms/'+dailyVoiceName(id,'all'))
  await assert.rejects(closeLiveVoiceRoom('bad','key',p.request),/Invalid/)
})
test('client and route respect feature gate, private credential, real JWT, and canonical room authority',()=>{
  const route=readFileSync('app/api/live/voice/[sessionId]/route.ts','utf8')
  const client=readFileSync('components/live-classroom/LiveVoice.tsx','utf8')
  const classroom=readFileSync('components/live-classroom/LiveClassroom.tsx','utf8')
  assert.match(route,/VIBE_LIVE_VOICE_SERVER_ENABLED/)
  assert.match(route,/sameOrigin\(req\)/)
  assert.match(route,/export const PATCH=/)
  assert.match(route,/method==='PATCH'/)
  assert.match(route,/parseVoiceDiagnostic/)
  assert.match(route,/vibeschool_live_voice_client_failure/)
  assert.match(route,/vibeschool_live_voice_request_failure/)
  assert.match(route,/voiceFailureCategory\(e\)/)
  assert.match(route,/if \(method === 'POST'\)/)
  assert.match(route,/category: voiceFailureCategory\(e\)/)
  assert.doesNotMatch(route,/console\.error\([^\n]*(?:user\.id|authorization|access_token|req\.body|e\.message)/)
  assert.match(route,/db\.rpc\('vibe_live_command'/)
  assert.doesNotMatch(route,/console\.error\([^\n]*(?:authorization|access_token|req\.headers)/)
  assert.match(client,/voiceDiagnosticHint/)
  assert.match(client,/reportFailure\(code,hint\)/)
  assert.match(client,/call\.on\('camera-error',event=>/)
  assert.match(client,/event\.errorMsg\?\.audioOk===true/)
  assert.match(client,/reportFailure\('device-error','device'\)/)
  assert.match(client,/Microphone unavailable\. Allow microphone access/)
  assert.match(route,/'device-error'/)
  assert.doesNotMatch(client,/console\.error\(event|console\.log\(event/)
  assert.match(route,/db\.auth\.getUser/)
  assert.match(route,/requireLiveVoiceAccessUser\(user\.id/)
  assert.match(route,/VIBE_LIVE_VOICE_ACCESS_SCOPE/)
  assert.match(route,/VIBE_LIVE_VOICE_PILOT_USER_IDS/)
  assert.match(route,/VIBE_LIVE_VOICE_PILOT_UNTIL/)
  assert.match(route,/accessScope === 'all'/)
  assert.match(route,/issueLiveVoiceToken\(room,user\.id,learnerStudentId,key,fetch,Date\.now\(\),accessScope\)/)
  assert.match(source,/vs-live-class-/)
  assert.match(source,/scope === 'all'/)
  assert.match(route,/p_action:'get'/)
  assert.match(route,/db\.rpc\('vibe_live_command'/)
  assert.match(route,/students'\)\.select\('id'/)
  assert.doesNotMatch(route,/service_role|SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(classroom,/NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true'/)
  assert.match(classroom,/<LiveVoice key=\{room.id\} enabled=\{process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true'\}/)
  assert.match(client,/enabled:boolean/)
  assert.match(client,/if\(!enabled\|\|!alive.current/)
  assert.match(client,/disabled=\{!enabled\|\|status!=='active'\}/)
  assert.match(client,/Audio is unavailable for this class/)
  assert.match(classroom,/onAcknowledge=\{async studentId=>/)
  assert.match(client,/updatePermissions:\{canSend:false\},setAudio:false/)
  assert.match(client,/Daily\.createCallObject\(\{videoSource:false,startVideoOff:true,startAudioOff:true\}\)/)
  assert.match(client,/unknownJoinMessage\(stage,hint\)/)
  assert.match(client,/Daily audio could not connect\. Retry/)
  assert.match(client,/setLocalAudio\(false\)/)
  assert.match(client,/setLocalAudio\(next\)/)
  assert.match(client,/micPreference\.current=next/)
  assert.match(client,/renewTimer\.current=setTimeout/)
  assert.match(client,/void stop\(true\)\.then/)
  assert.match(client,/currentStatus\.current==='active'/)
  assert.match(client,/expiresAt/)
  assert.match(source,/eject_at_token_exp:true/)
  assert.doesNotMatch(client,/setLocalVideo\(true\)|startRecording\(|getDisplayMedia\(/)
})
