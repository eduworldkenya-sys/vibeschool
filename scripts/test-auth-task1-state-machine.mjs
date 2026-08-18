import fs from 'node:fs'
import assert from 'node:assert/strict'

const base = fs.readFileSync('supabase/migrations/20260819013800_auth_canonical_journey_state.sql', 'utf8')
const repair = fs.readFileSync('supabase/migrations/20260819014900_auth_student_uuid_resolution_repair.sql', 'utf8')
const profileGrants = fs.readFileSync('supabase/migrations/20260819020500_auth_profile_authority_grants.sql', 'utf8')
const roleClaim = fs.readFileSync('supabase/migrations/20260819021200_auth_claim_role_production_reconcile.sql', 'utf8')
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

// Profile authority is denied at the grant layer, not only by downstream routing.
// Historical profile shapes are not identical, so the migration must intersect a
// fixed presentation-field allowlist with columns that actually exist at rebuild time.
assert.match(profileGrants,/revoke all on table public\.profiles from anon/i)
assert.match(profileGrants,/revoke update on table public\.profiles from authenticated/i)
assert.match(profileGrants,/pg_catalog\.pg_attribute/i)
assert.match(profileGrants,/a\.attrelid = 'public\.profiles'::regclass/i)
assert.match(profileGrants,/a\.attname = any \(array\[/i)
assert.match(profileGrants,/execute format\('grant update \(%s\) on table public\.profiles to authenticated'/i)
assert.match(profileGrants,/profiles_editable_column_allowlist_resolved_empty/i)

const allowlist = profileGrants.match(/a\.attname = any \(array\[([\s\S]*?)\]::text\[\]\)/i)?.[1] ?? ''
assert.ok(allowlist, 'profile editable allowlist must be explicit')
for (const field of ['full_name','phone','avatar_url','bio','updated_at']) {
  assert.match(allowlist, new RegExp(`['\"]${field}['\"]`, 'i'), `missing editable field ${field}`)
}
for (const field of ['role','school_id','account_status','is_anonymized','created_by','deleted_at']) {
  assert.ok(!new RegExp(`['\"]${field}['\"]`, 'i').test(allowlist), `authority field ${field} must not be client-updatable`)
}

// Role claim is one-time, self-service allowlisted, identity-bound and non-admin.
assert.match(roleClaim,/create or replace function public\.claim_my_initial_role\(p_role text\)/i)
assert.match(roleClaim,/security definer/i)
assert.match(roleClaim,/set search_path = public, auth, pg_temp/i)
assert.match(roleClaim,/p_role not in \('teacher','parent','global_user'\)/i)
assert.doesNotMatch(roleClaim,/p_role not in \([^)]*admin/i)
assert.match(roleClaim,/role is null/i)
assert.match(roleClaim,/revoke all on function public\.claim_my_initial_role\(text\) from public, anon/i)
assert.match(roleClaim,/grant execute on function public\.claim_my_initial_role\(text\) to authenticated/i)
assert.match(roleClaim,/guard_profile_authority_fields/i)

// Callback has exactly one authority path: the database resolver. No table-based fallback.
assert.doesNotMatch(callback,/resolveOnboardingFallback/)
assert.doesNotMatch(callback,/\.from\('school_members'\)/)
assert.doesNotMatch(callback,/\.from\('teacher_classes'\)/)
assert.doesNotMatch(callback,/\.from\('parent_student_links'\)/)
assert.match(callback,/if \(onboardingError\)[\s\S]*onboarding_resolution_failed/)

// Canonical resolver reasons survive callback classification; only true role-unclaimed
// accounts can enter self-service role claiming.
assert.match(callback,/reasonCode: typeof data\.reason_code === 'string'/)
assert.match(callback,/PROFILE_MISSING[\s\S]*profile_missing/)
assert.match(callback,/ADMIN_MEMBERSHIP_MISSING[\s\S]*admin_membership_missing/)
assert.match(callback,/AMBIGUOUS_LEARNER_IDENTITY[\s\S]*identity_conflict/)
assert.match(callback,/ACCOUNT_NOT_ACTIVE/)
assert.match(callback,/access\.reasonCode !== 'ROLE_UNCLAIMED'/)
assert.match(callback,/authority_resolution_failed/)

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
assert.match(recovery,/CSSProperties/)
assert.match(errorPage,/onboarding_resolution_failed/)
assert.match(errorPage,/admin_membership_missing/)
assert.match(errorPage,/identity_conflict/)

console.log('Task 1 canonical auth state-machine, authority and recovery contract: PASS')
