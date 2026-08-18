import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration = fs.readFileSync('supabase/migrations/20260819013800_auth_canonical_journey_state.sql', 'utf8')
const callback = fs.readFileSync('app/auth/callback/route.ts', 'utf8')
const middleware = fs.readFileSync('middleware.ts', 'utf8')

const journey = migration.match(/create or replace function public\.get_my_auth_journey_state\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
assert.ok(journey, 'canonical auth journey resolver missing')
assert.match(journey, /security definer/i)
assert.match(journey, /set search_path = public, auth, pg_temp/i)
assert.match(migration, /revoke all on function public\.get_my_auth_journey_state\(\) from public, anon/i)
assert.match(migration, /grant execute on function public\.get_my_auth_journey_state\(\) to authenticated, service_role/i)

for (const role of ['student','teacher','parent','admin','global_user']) assert.ok(journey.includes(`p.role = '${role}'`), `missing ${role} state lane`)
for (const destination of ['/student','/student/claim','/teacher/onboarding/school','/teacher/onboarding/class','/teacher/pulse','/parent/students','/parent','/admin','/global']) assert.ok(journey.includes(destination), `missing ${destination}`)

assert.match(journey, /sm\.role::text = 'teacher'/i)
assert.match(journey, /sm\.role::text in \('admin','owner'\)/i)
assert.match(journey, /join public\.students s on s\.id = psl\.student_id and s\.deleted_at is null/i)
assert.match(journey, /v_student_count > 1/i)
assert.doesNotMatch(journey, /teacher_classes[\s\S]{0,180}is_active/i)

const onboardingWrapper = migration.match(/create or replace function public\.get_my_onboarding_state\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
const accessWrapper = migration.match(/create or replace function public\.get_my_auth_access_state\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
const roleWrapper = migration.match(/create or replace function public\.get_my_role\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
for (const wrapper of [onboardingWrapper, accessWrapper, roleWrapper]) assert.match(wrapper, /get_my_auth_journey_state/i)

// The emergency callback fallback must never depend on a teacher_classes column
// that is not present in production.
assert.doesNotMatch(callback, /teacher_classes'[\s\S]{0,220}\.eq\('is_active'/i)

// Middleware remains fail-closed and validates role-compatible destinations.
assert.match(middleware, /roleCanVisit/)
assert.match(middleware, /authError\('onboarding_invalid'\)/)

console.log('Task 1 canonical auth state-machine contract: PASS')
