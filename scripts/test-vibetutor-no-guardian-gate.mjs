import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const migration = readFileSync('supabase/migrations/20261121140000_vibetutor_no_guardian_approval.sql','utf8')
const baseMigration = readFileSync('supabase/migrations/20261120130000_vibetutor_public_learner_preview.sql','utf8')
const listings = readFileSync('components/vibetutor/listings.ts','utf8')
const form = readFileSync('app/vibetutor/post-request/page.tsx','utf8')
const cards = readFileSync('components/vibetutor/Cards.tsx','utf8')
test('Public learner requests no longer need guardian role or approval',()=>{
 assert.match(migration,/p\.role::text in \('parent','teacher'\)/)
 assert.doesNotMatch(migration,/p\.role::text='parent'/)
 assert.match(form,/useState\(true\)/)
 assert.doesNotMatch(form,/I am this learner’s parent or guardian/)
 assert.match(form,/no separate guardian approval/)
 assert.match(listings,/\['parent', 'teacher'\]/)
 assert.doesNotMatch(listings,/profile\?\.role !== 'parent'/)
})
test('Imported teacher-owned synthetic/unknown requests remain nonpublic',()=>{
 assert.match(migration,/r\.source='vibetutor'/)
 assert.match(migration,/r\.public_preview/)
 assert.match(baseMigration,/public_preview boolean not null default false/)
 assert.doesNotMatch(migration,/update public\.vibetutor_requests set public_preview=true/i)
})
test('Public projection excludes child identity, private contact, and arbitrary notes',()=>{
 assert.match(migration,/null::text as note/)
 assert.match(migration,/Learner-/)
 const view=migration.split('create or replace view public.vibetutor_open_requests')[1].split('revoke all on public.vibetutor_open_requests')[0]
 assert.doesNotMatch(view,/r\.phone|r\.learner_label|r\.note|r\.requester_id|select\s+\*/i)
 assert.match(migration,/revoke all on public\.vibetutor_open_requests from public, anon, authenticated;/)
 assert.match(migration,/grant select on public\.vibetutor_open_requests to anon, authenticated;/)
})
test('Authenticated teacher interest is not anonymous nor self-contact; requester controls replies',()=>{
 assert.match(migration,/t\.status='published' and p\.role::text='teacher'/)
 assert.match(migration,/r\.requester_id<>v_user/)
 assert.match(migration,/r\.requester_id=v_user/)
 assert.match(migration,/created_at>now\(\)-interval '24 hours'/)
 assert.match(migration,/revoke all on function public\.vibetutor_request_interest_send/)
 assert.match(cards,/Sign in to contact request owner/)
})
