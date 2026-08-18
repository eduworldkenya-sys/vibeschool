import fs from 'node:fs'
import assert from 'node:assert/strict'

const base = fs.readFileSync('supabase/migrations/20260819013800_auth_canonical_journey_state.sql', 'utf8')
const repair = fs.readFileSync('supabase/migrations/20260819014900_auth_student_uuid_resolution_repair.sql', 'utf8')
const callback = fs.readFileSync('app/auth/callback/route.ts', 'utf8')
const middleware = fs.readFileSync('middleware.ts', 'utf8')
const routing = fs.readFileSync('lib/auth-routing.ts', 'utf8')
const recovery = fs.readFileSync('app/auth/error/RecoveryActions.tsx', 'utf8')
const errorPage = fs.readFileSync('app/auth/error/page.tsx', 'utf8')

const journey = repair.match(/create or replace function public\.get_my_auth_journey_state\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? ''
assert.ok(journey)
assert.match(journey,/security definer/i)
assert.match(journey,/set search_path = public, auth, pg_temp/i)
for (const role of ['student','teacher','parent','admin','global_user']) assert.ok(journey.includes(`p.role='${role}'`) || journey.includes(`p.role = '${role}'`), `missing ${role}`)
assert.doesNotMatch(journey,/min\s*\(\s*s\.id\s*\)/i)
assert.doesNotMatch(journey,/teacher_classes[\s\S]{0,180}is_active/i)
assert.match(repair,/create or replace function public\.current_student_id\(\)/i)
assert.doesNotMatch(repair,/min\s*\(\s*s\.id\s*\)/i)
assert.match(repair,/order by s\.id limit 1/i)
assert.match(base,/get_my_auth_journey_state/i)
for (const wrapper of ['get_my_onboarding_state','get_my_auth_access_state','get_my_role']) assert.match(base,new RegExp(`create or replace function public\\.${wrapper}\\([\\s\\S]*?get_my_auth_journey_state`,'i'))

// Callback has exactly one authority path: the database resolver. No table-based fallback.
assert.doesNotMatch(callback,/resolveOnboardingFallback/)
assert.doesNotMatch(callback,/\.from\('school_members'\)/)
assert.doesNotMatch(callback,/\.from\('teacher_classes'\)/)
assert.doesNotMatch(callback,/\.from\('parent_student_links'\)/)
assert.match(callback,/if \(onboardingError\)[\s\S]*onboarding_resolution_failed/)

// Protected deep links remain role protected even when query/hash components are present.
assert.match(routing,/pathnameOnly/)
assert.match(routing,/indexOf\('\?'\)/)
assert.match(routing,/indexOf\('#'\)/)
assert.match(middleware,/roleCanVisit/)
assert.match(middleware,/authError\('onboarding_invalid'\)/)

// Recovery UX has live retry, change-account/logout, home navigation, loading and error states.
assert.match(recovery,/Try Again/)
assert.match(recovery,/\/auth\/logout/)
assert.match(recovery,/Change account/)
assert.match(recovery,/VibeSchool Home/)
assert.match(recovery,/aria-busy/)
assert.match(recovery,/role="alert"/)
assert.match(errorPage,/onboarding_resolution_failed/)
assert.match(errorPage,/admin_membership_missing/)
assert.match(errorPage,/identity_conflict/)

console.log('Task 1 canonical auth state-machine and recovery contract: PASS')
