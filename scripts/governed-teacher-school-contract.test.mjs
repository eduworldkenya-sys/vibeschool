import fs from 'node:fs'
import assert from 'node:assert/strict'

const sql = fs.readFileSync('supabase/migrations/20260902104000_governed_teacher_school_claims_current.sql','utf8')
const page = fs.readFileSync('app/teacher/onboarding/school/page.tsx','utf8')
const pending = fs.readFileSync('app/teacher/onboarding/school/pending/page.tsx','utf8')
const hqPage = fs.readFileSync('app/hq/schools/data-quality/page.tsx','utf8')
const hqQueue = fs.readFileSync('components/hq/TeacherSchoolClaimQueue.tsx','utf8')

const submit = sql.match(/create or replace function public\.submit_teacher_school_claim[\s\S]*?\n\$\$;/i)?.[0] ?? ''
const directWrapper = sql.match(/create or replace function public\.connect_teacher_to_school[\s\S]*?\n\$\$;/i)?.[0] ?? ''
const directoryWrapper = sql.match(/create or replace function public\.connect_teacher_to_directory_school[\s\S]*?\n\$\$;/i)?.[0] ?? ''
const review = sql.match(/create or replace function public\.review_teacher_school_claim[\s\S]*?\n\$\$;/i)?.[0] ?? ''

assert.ok(submit, 'submit claim function missing')
assert.ok(review, 'review claim function missing')
assert.match(sql,/create table if not exists public\.teacher_school_claims/i)
assert.match(sql,/enable row level security/i)
assert.match(sql,/teacher_id=\(select auth\.uid\(\)\)/i)
assert.match(sql,/teacher_school_claim_has_target[\s\S]*num_nonnulls\(school_id,directory_school_id\) >= 1/i)
assert.match(submit,/active_teacher_required/i)
assert.match(submit,/exactly_one_school_claim_target_required/i)
assert.match(submit,/valid_requested_level_required/i)
assert.doesNotMatch(submit,/insert into public\.school_members/i,'claim submission must not grant membership')
assert.doesNotMatch(directWrapper,/insert into public\.school_members/i,'legacy direct wrapper must not grant membership')
assert.doesNotMatch(directoryWrapper,/insert into public\.school_members/i,'legacy directory wrapper must not grant membership')
assert.match(review,/claim_reviewer_authority_required/i)
assert.match(review,/is_platform_owner\(\)/i)
assert.match(review,/is_school_admin\(v_school\)/i)
assert.match(review,/if p_action='approved'[\s\S]*insert into public\.school_members/i)
assert.match(review,/on conflict\(school_id,profile_id\) do nothing/i)
assert.doesNotMatch(review,/do update set role='teacher'/)
assert.match(review,/claim_already_resolved/i)
assert.match(review,/canonical_school_resolution_required/i)
assert.match(sql,/revoke all on function public\.review_teacher_school_claim/i)
assert.match(sql,/grant execute on function public\.review_teacher_school_claim[\s\S]*to authenticated/i)

for (const marker of ['submit_school_discovery_request','schoolCode','alternativeName','notes','hasAmbiguousNames','search_school_directory']) {
  assert.ok(page.includes(marker), `school discovery regression: ${marker} missing`)
}
assert.match(page,/Submit school for verification/)
assert.match(page,/does not grant school access until an authorized reviewer approves it/i)
assert.match(page,/router\.push\("\/teacher\/onboarding\/school\/pending"\)/)
assert.match(page,/get_my_teacher_school_claim/)
assert.match(pending,/authorized school administrator or platform owner/i)
assert.match(pending,/status==="approved"[\s\S]*\/teacher\/classhub/i)

assert.match(hqPage,/TeacherSchoolClaimQueue/)
assert.match(hqQueue,/hq_list_teacher_school_claims/)
assert.match(hqQueue,/review_teacher_school_claim/)
assert.match(hqQueue,/p_action: dialog\.action/)
assert.match(hqQueue,/disabled=\{busy === claim\.id \|\| !claim\.school_id\}/)
assert.match(hqQueue,/Existing admin\/owner roles are preserved/i)
assert.match(hqQueue,/This action does not create school authority/i)

console.log('governed teacher-school authorization contract: PASS')
