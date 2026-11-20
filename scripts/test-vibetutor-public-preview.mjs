import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
test('guest learner preview is restricted to parent opt-in and no private columns',()=>{
 const sql=readFileSync('supabase/migrations/20261120130000_vibetutor_public_learner_preview.sql','utf8')
 assert.match(sql,/r\.public_preview and p\.role::text='parent'/)
 assert.match(sql,/null::text as note/)
 assert.match(sql,/default false/)
 assert.doesNotMatch(sql,/select r\.\*/)
 assert.match(sql,/grant select on public\.vibetutor_open_requests to anon, authenticated/)
 const browse=readFileSync('app/vibetutor/browse/BrowseClient.tsx','utf8')
 assert.doesNotMatch(browse,/Sign in to view learner requests/)
 assert.doesNotMatch(browse,/view === 'students' && live\?\.signedIn/)
 const cards=readFileSync('components/vibetutor/Cards.tsx','utf8')
 assert.match(cards,/Sign in to contact guardian/)
})
