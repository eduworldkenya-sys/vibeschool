import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261121173000_vibetutor_published_imported_requests.sql','utf8')
const browse=readFileSync('app/vibetutor/browse/BrowseClient.tsx','utf8')
const listings=readFileSync('components/vibetutor/listings.ts','utf8')
const cards=readFileSync('components/vibetutor/Cards.tsx','utf8')
test('imported owner-managed requests are public without separate synthetic sample table',()=>{
 assert.match(sql,/r\.source in \('vibetutor','hq_import_20261120_f','hq_import_20261120_m'\)/)
 assert.match(sql,/update public\.vibetutor_requests r\s+set public_preview = true/)
 assert.match(sql,/r\.status='open' and r\.public_preview=false/)
 assert.match(sql,/Grade 10/)
 assert.match(sql,/Form 3/)
 assert.match(browse,/visibleLevels/)
 assert.doesNotMatch(sql,/vibetutor_sample_requests/)
 assert.match(listings,/vibetutor_open_requests/)
})
test('public request read is anonymized; contacts only signed-in published tutors',()=>{
 const view=sql.split('create or replace view public.vibetutor_open_requests')[1].split('revoke all on public.vibetutor_open_requests')[0]
 assert.match(view,/null::text as note/)
 assert.match(view,/Learner-/)
 assert.doesNotMatch(view,/r\.phone|r\.learner_label|r\.note|r\.requester_id\s*,|select\s+\*/i)
 assert.match(sql,/revoke all on public\.vibetutor_open_requests from public, anon, authenticated/)
 assert.match(sql,/grant select on public\.vibetutor_open_requests to anon, authenticated/)
 assert.match(sql,/t\.status='published' and p\.role::text='teacher'/)
 assert.match(sql,/r\.requester_id<>v_user/)
 assert.match(sql,/r\.requester_id=v_user/)
 assert.match(sql,/created_at>now\(\)-interval '24 hours'/)
 assert.match(cards,/Sign in to contact request owner/)
})
