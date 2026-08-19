import fs from 'node:fs'
import assert from 'node:assert/strict'

const directory = fs.readFileSync('supabase/migrations/20260819224500_auth_teacher_directory_connect_authority_guard.sql', 'utf8')
const transitions = fs.readFileSync('supabase/migrations/20260819225000_auth_identity_role_transition_guards.sql', 'utf8')
const legacyParentRoute = fs.readFileSync('app/parent/create-child/page.tsx', 'utf8')

assert.match(directory, /create or replace function public\.connect_teacher_to_directory_school/i)
assert.match(directory, /security definer/i)
assert.match(directory, /set search_path = public, auth, extensions, pg_temp/i)
assert.match(directory, /v_uid uuid := auth\.uid\(\)/i)
assert.match(directory, /v_role is distinct from 'teacher'/i)
assert.match(directory, /v_status is distinct from 'active'/i)
assert.match(directory, /or v_anonymized/i)
assert.match(directory, /teacher_authority_required/i)
assert.match(directory, /reviewed_by is not null/i)
assert.match(directory, /reviewed_at is not null/i)
assert.match(directory, /revoke all on function public\.connect_teacher_to_directory_school\(uuid,text\) from public, anon, service_role/i)

for (const fn of ['connect_teacher_to_school','onboard_teacher_class']) {
  assert.match(transitions, new RegExp(`create or replace function public\\.${fn}`,'i'))
}
assert.match(transitions, /v_role is distinct from 'teacher'/i)
assert.match(transitions, /teacher_school_membership_required/i)
assert.match(transitions, /sm\.role::text='teacher'/i)
assert.match(transitions, /revoke all on function public\.connect_teacher_to_school\(uuid,text\) from public, anon, service_role/i)
assert.match(transitions, /revoke all on function public\.onboard_teacher_class\(uuid,uuid,text,text,text\) from public, anon, service_role/i)

assert.match(transitions, /create or replace function public\.redeem_parent_claim/i)
assert.match(transitions, /v_role is distinct from 'parent'/i)
assert.match(transitions, /parent_authority_required/i)
assert.doesNotMatch(transitions, /role=case when role is null or role='teacher' then 'parent'/i)

assert.match(transitions, /create or replace function public\.redeem_student_claim/i)
assert.match(transitions, /v_role is not null and v_role <> 'student'/i)
assert.match(transitions, /learner_identity_already_bound/i)
assert.match(transitions, /ambiguous_learner_identity/i)
assert.match(transitions, /where id=v_user_id and \(role is null or role::text='student'\)/i)

assert.match(transitions, /revoke all on function public\.create_child_for_parent\(text,date,uuid\) from public, anon, authenticated, service_role/i)
assert.match(legacyParentRoute, /redirect\('\/parent\/link-child'\)/i)
assert.doesNotMatch(legacyParentRoute, /create_child_for_parent/i)

console.log('Task 1 onboarding authority and role-transition regression: PASS')
