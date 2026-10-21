import test from 'node:test'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {selectRetiredMediaUploads} from './cleanup-queue'

test('cleanup pages eligible non-deleted reservations, never the oldest 20 messages', async () => {
  const now='2026-10-21T12:00:00.000Z'
  let url: URL | undefined
  const fixture={message_id:'11111111-1111-4111-8111-111111111111',asset_id:'private-asset',state:'ready',provider:'cloudflare-stream',upload_expires_at:'2026-10-20T12:00:00.000Z'}
  const db=createClient('https://example.supabase.co','fixture-public-key',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch: async (resource) => {
      url=new URL(String(resource))
      return new Response(JSON.stringify([fixture]),{status:200,headers:{'content-type':'application/json'}})
    }},
  })
  const {data,error}=await selectRetiredMediaUploads(db,now)
  assert.equal(error,null)
  assert.deepEqual(data?.map((row)=>row.message_id),[fixture.message_id])
  assert.ok(url)
  assert.equal(url.pathname,'/rest/v1/success_wishes_media_uploads')
  assert.match(url.searchParams.get('select')||'',/success_wishes_messages!inner/)
  assert.equal(url.searchParams.get('state'),'in.(ready,issued,processing,cleanup_required)')
  assert.equal(url.searchParams.get('upload_expires_at'),'lte.'+now)
  assert.equal(url.searchParams.get('success_wishes_messages.or'),'(state.in.(withdrawn,blocked,expired),expires_at.lt.'+now+')')
  assert.equal(url.searchParams.get('order'),'upload_expires_at.asc')
  assert.equal(url.searchParams.get('limit'),'20')
})
