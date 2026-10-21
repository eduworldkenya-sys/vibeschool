import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {GET as getVoice} from '../../app/api/success-wishes/media/voice-playback/route'
import {GET as getVideo} from '../../app/api/success-wishes/media/playback/route'

const id='11111111-1111-4111-8111-111111111111'

test('both private playback endpoints enforce media emergency stop before session lookup', async () => {
  const names=['SUCCESS_WISHES_ENABLED','SUCCESS_WISHES_MEDIA_CERTIFIED','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'] as const
  const previous=names.map(name=>process.env[name])
  try {
    process.env.SUCCESS_WISHES_ENABLED='true'
    process.env.SUCCESS_WISHES_MEDIA_CERTIFIED='false'
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-private-key'
    for (const [path,handler] of [
      ['voice-playback',getVoice],['playback',getVideo],
    ] as const) {
      const response=await handler(new NextRequest('https://vibeschool.example/api/success-wishes/media/'+path+'?messageId='+id))
      assert.equal(response.status,503,path)
      assert.match(response.headers.get('cache-control')||'',/no-store/)
      assert.equal(JSON.stringify(await response.json()).includes(id),false)
    }
  } finally {
    names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i]})
  }
})
