import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync('lib/live/voice.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {LiveVoiceError,validateVoiceRoom,voiceUuid,issueLiveVoiceToken,closeLiveVoiceRoom,dailyVoiceName}=
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
  exp,eject_at_room_exp:true,max_participants:80,enforce_unique_user_ids:true,
  enable_knocking:false,enable_recording:false,enable_screenshare:false,enable_chat:false,
  audio_only:true,start_audio_off:true,start_video_off:true,enable_prejoin_ui:false,
}}
function response(status,body){return {status,ok:status>=200&&status<300,json:async()=>body}}
function mockProvider({existing=true,override=null,token='signed-token'}={}){
  const calls=[]
  const request=async(url,options)=>{
    const path=url.replace('https://api.daily.co/v1/','')
    const body=options.body?JSON.parse(options.body):null
    calls.push({path,method:options.method,body,headers:options.headers})
    if (path==='rooms/'+name && options.method==='GET')return response(existing?200:404,override??roomInfo)
    if (path==='rooms' && options.method==='POST')return response(200,override??roomInfo)
    if (path==='meeting-tokens')return response(200,{token})
    if (path==='rooms/'+name && options.method==='DELETE')return response(200,{})
    return response(500,{})
  }
  return {request,calls}
}

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
  assert.deepEqual(tokenRequest.permissions.canSend,['audio'])
  assert.deepEqual(tokenRequest.permissions.canAdmin,['participants'])
  assert.equal(tokenRequest.enable_recording,false)
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
  assert.equal(create.properties.start_audio_off,true)
  assert.equal(create.properties.start_video_off,true)
  assert.equal(create.properties.enable_recording,false)
  assert.equal(create.properties.enable_screenshare,false)
  assert.equal(create.properties.audio_only,true)
  assert.equal(create.properties.start_audio_off,true)
  assert.equal(create.properties.start_video_off,true)
  for(const data of [
    {...roomInfo,privacy:'public'},
    {...roomInfo,name:'vs-other'},
    {...roomInfo,config:{...roomInfo.config,enable_recording:'cloud'}},
    {...roomInfo,config:{...roomInfo.config,max_participants:100}},
    {...roomInfo,config:{...roomInfo.config,eject_at_room_exp:false}},
    {...roomInfo,config:{...roomInfo.config,enable_screenshare:true}},
    {...roomInfo,config:{...roomInfo.config,audio_only:false}},
    {...roomInfo,config:{...roomInfo.config,start_audio_off:false}},
  ]){
    const p=mockProvider({override:data})
    await assert.rejects(issueLiveVoiceToken(teacherRoom,actor,null,'key',p.request,now),/privacy verification/)
    assert.equal(p.calls.filter(c=>c.path==='meeting-tokens').length,0)
  }
})
test('teacher can terminate exact media room on canonical class end',async()=>{
  const p=mockProvider()
  await closeLiveVoiceRoom(id,'key',p.request)
  assert.equal(p.calls.length,1)
  assert.equal(p.calls[0].method,'DELETE')
  assert.equal(p.calls[0].path,'rooms/'+name)
  await assert.rejects(closeLiveVoiceRoom('bad','key',p.request),/Invalid/)
})
test('client and route respect feature gate, private credential, real JWT, and canonical room authority',()=>{
  const route=readFileSync('app/api/live/voice/[sessionId]/route.ts','utf8')
  const client=readFileSync('components/live-classroom/LiveVoice.tsx','utf8')
  const classroom=readFileSync('components/live-classroom/LiveClassroom.tsx','utf8')
  assert.match(route,/VIBE_LIVE_VOICE_SERVER_ENABLED/)
  assert.match(route,/sameOrigin\(req\)/)
  assert.match(route,/db\.auth\.getUser/)
  assert.match(route,/p_action:'get'/)
  assert.match(route,/db\.rpc\('vibe_live_command'/)
  assert.match(route,/students'\)\.select\('id'/)
  assert.doesNotMatch(route,/service_role|SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(classroom,/NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED==='true'/)
  assert.match(classroom,/onAcknowledge=\{async studentId=>/)
  assert.match(client,/updatePermissions:\{canSend:false\},setAudio:false/)
  assert.match(client,/Daily\.createCallObject/)
  assert.match(client,/setLocalAudio\(false\)/)
  assert.match(client,/setLocalAudio\(!micOn\)/)
  assert.match(client,/renewTimer\.current=setTimeout/)
  assert.match(client,/void stop\(\)\.then/)
  assert.match(client,/currentStatus\.current==='active'/)
  assert.match(client,/expiresAt/)
  assert.match(source,/eject_at_token_exp:true/)
  assert.doesNotMatch(client,/setLocalVideo\(true\)|startRecording\(|getDisplayMedia\(/)
})
