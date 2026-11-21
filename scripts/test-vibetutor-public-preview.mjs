import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const migration=readFileSync('supabase/migrations/20261120130000_vibetutor_public_learner_preview.sql','utf8')
const browse=readFileSync('app/vibetutor/browse/BrowseClient.tsx','utf8')
const listing=readFileSync('components/vibetutor/listings.ts','utf8')
const cards=readFileSync('components/vibetutor/Cards.tsx','utf8')
test('anonymous preview defaults private, never exposes child identity, notes or phones',()=>{
 assert.match(migration,/public_preview boolean not null default false/)
 assert.match(migration,/r\.public_preview and p\.role::text='parent'/)
 assert.match(migration,/null::text as note/)
 assert.match(migration,/grant select on public\.vibetutor_open_requests to anon, authenticated/)
 assert.doesNotMatch(migration,/select r\.\*/)
 assert.match(migration,/available_days <@/)
})
test('guest can browse; sign-in is only contact gate',()=>{
 assert.doesNotMatch(browse,/Sign in to view learner requests/)
 assert.doesNotMatch(browse,/view === 'students' && live\?\.signedIn/)
 assert.match(listing,/Public projection|public projection/i)
 assert.match(cards,/Sign in to contact guardian/)
})
test('guardian inquiry RPC is verified, rate-limited and unpublish revokes contacts',()=>{
 assert.match(migration,/t\.status='published' and p\.role::text='teacher'/)
 assert.match(migration,/created_at>now\(\)-interval '24 hours'/)
 assert.match(migration,/delete from public\.vibetutor_request_interests/)
 assert.match(migration,/revoke all on function public\.vibetutor_request_interest_send/)
 assert.match(migration,/tutor_id=\(select auth\.uid\(\)\)/)
})
