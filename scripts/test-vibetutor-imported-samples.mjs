import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261121173000_vibetutor_imported_sample_directory.sql','utf8')
const browse=readFileSync('app/vibetutor/browse/BrowseClient.tsx','utf8')
const listings=readFileSync('components/vibetutor/listings.ts','utf8')
const cards=readFileSync('components/vibetutor/Cards.tsx','utf8')
test('all imported grade groups can be shown without publishing base requests',()=>{
  assert.match(sql,/hq_import_20261120_f/)
  assert.match(sql,/hq_import_20261120_m/)
  assert.match(sql,/Grade 10/)
  assert.match(sql,/Form 3/)
  assert.doesNotMatch(sql,/update public\.vibetutor_requests|insert into public\.vibetutor_requests/i)
  assert.match(browse,/samplePreview/)
  assert.match(browse,/Sample learner requests/)
  assert.match(browse,/levelValues/)
})
test('public samples contain no child identifying information and have no contact',()=>{
  assert.match(sql,/null::text/)
  assert.doesNotMatch(sql,/r\.learner_label|r\.phone|r\.requester_id|r\.note/)
  assert.match(sql,/revoke all on public\.vibetutor_sample_requests from public, anon, authenticated/)
  assert.match(sql,/grant select on public\.vibetutor_sample_requests to anon, authenticated/)
  assert.doesNotMatch(sql,/grant (insert|update|delete)/i)
  assert.match(listings,/real: false/)
  assert.match(cards,/!r\.real \? <div className=\{styles\.hint\}>This is a demonstration request/)
  assert.match(cards,/Contact is disabled/)
})
test('genuine requests remain separately contacted only through guarded backend',()=>{
  assert.match(listings,/vibetutor_open_requests/)
  assert.match(listings,/vibetutor_sample_requests/)
  assert.match(browse,/live\?\.requests.length \? live.requests : live\?\.sampleRequests/)
  assert.match(cards,/!signedIn \? <Link href=/)
})
