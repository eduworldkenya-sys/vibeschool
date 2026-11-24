import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261121081306_vibetutor_published_imported_requests.sql','utf8')
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

test('real learner names are read only from the authenticated request owner’s RLS-scoped rows',()=>{
 assert.match(listings,/const ownedNamesById = new Map<string, string>\(\)/)
 assert.match(listings,/auth\.getUser\(\)/)
 assert.match(listings,/\.from\('vibetutor_requests'\)/)
 assert.match(listings,/\.select\('id,learner_label'\)/)
 assert.match(listings,/\.eq\('requester_id', verified\.user\.id\)/)
 assert.match(listings,/\.eq\('status', 'open'\)/)
 assert.match(listings,/\.eq\('public_preview', true\)/)
 assert.match(listings,/learnerLabel: ownedNamesById\.get\(row\.id\) \?\?/)
 assert.match(listings,/ownedNamesById\.get\(row\.id\) \?\? row\.learner_label/)
 assert.doesNotMatch(listings,/learnerLabel: row\.learner_label/)
 const view=sql.split('create or replace view public.vibetutor_open_requests')[1].split('revoke all on public.vibetutor_open_requests')[0]
 assert.doesNotMatch(view,/r\.learner_label|r\.phone|r\.requester_id\s*,/i)
})

const consentedPublicName = readFileSync('supabase/migrations/20261121090520_vibetutor_consent_gated_public_first_names.sql', 'utf8')
test('visitor receives only the first name when parent/guardian name-publication consent was independently verified',()=>{
 assert.match(consentedPublicName,/create table if not exists public\.vibetutor_request_public_first_name_consents/)
 assert.match(consentedPublicName,/guardian_consent_evidence_ref text not null/)
 assert.match(consentedPublicName,/verified_by uuid not null/)
 assert.match(consentedPublicName,/revoked_at timestamptz/)
 assert.match(consentedPublicName,/alter table public\.vibetutor_request_public_first_name_consents enable row level security/)
 assert.match(consentedPublicName,/revoke all on public\.vibetutor_request_public_first_name_consents from public, anon, authenticated/)
 assert.doesNotMatch(consentedPublicName,/grant (?:all|insert|update|delete) on public\.vibetutor_request_public_first_name_consents to (?:anon|authenticated)/i)
 const view = consentedPublicName.split('create or replace view public.vibetutor_open_requests')[1].split('revoke all on public.vibetutor_open_requests')[0]
 assert.match(view,/case when consent\.request_id is not null and consent\.revoked_at is null/)
 assert.match(view,/then split_part\(btrim\(r\.learner_label\),' ',1\)/)
 assert.match(view,/else coalesce\(nullif\(r\.levels\[1\],''\),'Learner'\) \|\| ' tuition request'/)
 assert.doesNotMatch(view,/r\.phone|r\.note|r\.requester_id\s*,|select\s+\*/i)
 assert.doesNotMatch(consentedPublicName,/update public\.vibetutor_requests\s+set public_preview\s*=\s*true/i)
 assert.match(listings,/learnerLabel: ownedNamesById\.get\(row\.id\) \?\? row\.learner_label/)
})
