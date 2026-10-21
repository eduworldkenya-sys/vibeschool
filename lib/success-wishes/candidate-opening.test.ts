import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {GET as inbox} from '../../app/api/success-wishes/inbox/route'
import {POST as action} from '../../app/api/success-wishes/actions/route'
import {GET as voice} from '../../app/api/success-wishes/media/voice-playback/route'
import {GET as video} from '../../app/api/success-wishes/media/playback/route'

const origin='https://vibeschool.example'
const messageId='11111111-1111-4111-8111-111111111111'

test('unverified candidate cannot read any inbox or obtain audio/video capabilities',async()=>{
  const urls=[
    ['/api/success-wishes/inbox',inbox],
    ['/api/success-wishes/media/voice-playback?messageId='+messageId,voice],
    ['/api/success-wishes/media/playback?messageId='+messageId,video],
  ] as const
  for(const [path,handler] of urls){
    const response=await handler(new NextRequest(origin+path))
    assert.equal(response.status,401,path)
    assert.match(response.headers.get('cache-control')||'',/no-store/)
    const result=await response.json()
    assert.equal(Object.hasOwn(result,'messages'),false)
    assert.equal(Object.hasOwn(result,'url'),false)
  }
})
test('opening another candidate message is not possible without a valid school-issued guest session',async()=>{
  const response=await action(new NextRequest(origin+'/api/success-wishes/actions',{
    method:'POST',headers:{origin,'content-type':'application/json'},
    body:JSON.stringify({messageId,action:'accept'}),
  }))
  assert.equal(response.status,401)
  assert.match(response.headers.get('cache-control')||'',/no-store/)
  assert.deepEqual(Object.keys(await response.json()),['error'])
})
test('cross-site web pages cannot submit candidate acceptance, hiding or block actions',async()=>{
  for(const selected of ['accept','hide','block','report']){
    const response=await action(new NextRequest(origin+'/api/success-wishes/actions',{
      method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},
      body:JSON.stringify({messageId,action:selected}),
    }))
    assert.equal(response.status,403,selected)
  }
})
