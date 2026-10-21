import test from 'node:test'
import assert from 'node:assert/strict'
import {createPrivateVoiceAdapter,VOICE_BUCKET,voiceObjectPath,validVoiceUpload} from './voice'
const id='00000000-0000-4000-8000-000000000001'
const asset='00000000-0000-4000-8000-000000000002'
const path=voiceObjectPath(id,'audio/webm',asset)
test('private voice path belongs to exactly one message',()=>{
  assert.equal(path,id+'/'+asset+'.webm')
  for(const kind of ['audio/x-executable','video/webm','audio/wav']) assert.throws(()=>validVoiceUpload(kind,120))
  for(const size of [0,25*1024*1024+1,1.5]) assert.throws(()=>validVoiceUpload('audio/webm',size))
  assert.throws(()=>voiceObjectPath('../outside','audio/webm'))
})
function provider(overrides:Record<string,unknown>={}) {
  const calls:string[]=[]
  const api={
    createSignedUploadUrl:async(path:string)=>{calls.push('reserve');return {data:{path,token:'private-token',signedUrl:'https://voice.example/upload'},error:null}},
    info:async(_path:string)=>{calls.push('info');return {data:{size:1200,contentType:'audio/webm'},error:null}},
    createSignedUrl:async(_path:string,n:number)=>{calls.push('signed:'+n);return {data:{signedUrl:'https://voice.example/signed'},error:null}},
    remove:async(_paths:string[])=>{calls.push('remove');return {data:[],error:null}},
    ...overrides,
  }
  return {store:{from:(bucket:string)=>{assert.equal(bucket,VOICE_BUCKET);return api}},calls}
}
test('voice uploads are private capabilities, with no public URL',async()=>{
  const p=provider()
  const a=createPrivateVoiceAdapter(p.store)
  const issued=await a.reserve(id,'audio/webm',1200)
  assert.match(issued.path,/\.webm$/)
  assert.equal(issued.uploadToken,'private-token')
  assert.equal(issued.uploadUrl,'https://voice.example/upload')
  assert.deepEqual(p.calls,['reserve'])
})
test('voice playback checks message ownership, trusted duration and storage metadata',async()=>{
  const p=provider()
  const a=createPrivateVoiceAdapter(p.store)
  await assert.rejects(a.signedPlayback(id,path,61),/duration/)
  await assert.rejects(a.signedPlayback('00000000-0000-4000-8000-000000000003',path,25),/not associated/)
  const playable=await a.signedPlayback(id,path,59)
  assert.equal(playable.ttlSeconds,300)
  assert.deepEqual(p.calls,['info','signed:300'])
  const wrong=provider({info:async()=>({data:{size:1200,contentType:'audio/mpeg'},error:null})})
  await assert.rejects(createPrivateVoiceAdapter(wrong.store).signedPlayback(id,path,30),/format/)
})
test('provider errors fail closed and failed deletes cannot be treated as done',async()=>{
  const fail=provider({remove:async()=>({data:null,error:new Error('down')})})
  await assert.rejects(createPrivateVoiceAdapter(fail.store).deleteVoice(id,path),/reconciliation/)
  const ok=provider()
  await createPrivateVoiceAdapter(ok.store).deleteVoice(id,path)
  assert.deepEqual(ok.calls,['remove'])
})
