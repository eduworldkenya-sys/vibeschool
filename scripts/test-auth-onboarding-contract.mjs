import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const callback = read('app/auth/callback/route.ts')
const middleware = read('middleware.ts')
const routing = read('lib/auth-routing.ts')
const migration = read('supabase/migrations/20260816154000_auth_onboarding_authority_reconcile.sql')
const teacherSignup = read('app/signup/teacher/page.tsx')
const parentSignup = read('app/signup/parent/page.tsx')
const globalSignup = read('app/global/signup/page.tsx')
const login = read('app/login/[role]/page.tsx')
const forgot = read('app/auth/forgot-password/page.tsx')
const reset = read('app/auth/reset-password/page.tsx')
const errorPage = read('app/auth/error/page.tsx')
const logout = read('app/auth/logout/route.ts')
const sw = read('public/sw.js')

// New identities are unclassified; provider/user metadata is never role authority.
assert.match(migration, /alter table public\.profiles alter column role drop default/i)
const handleNewUser = migration.match(/create or replace function public\.handle_new_user[\s\S]*?\$\$;/i)?.[0] ?? ''
assert.match(handleNewUser, /values\s*\([\s\S]*?null[\s\S]*?'active'/i)
assert.doesNotMatch(handleNewUser, /raw_user_meta_data->>'role'/i)

// Explicit public signup can classify only self-service roles, once.
const claim = migration.match(/create or replace function public\.claim_my_initial_role[\s\S]*?\$\$;/i)?.[0] ?? ''
assert.match(claim, /p_role not in \('teacher','parent','global_user'\)/i)
assert.doesNotMatch(claim, /'admin'|'student'/i)
assert.match(claim, /if v_current_role is not null then return v_current_role/i)

// Direct client profile writes cannot alter canonical authority fields.
const guard = migration.match(/create or replace function public\.guard_profile_authority_fields[\s\S]*?\$\$;/i)?.[0] ?? ''
for (const field of ['role', 'account_status', 'is_anonymized', 'school_id']) {
  assert.ok(guard.includes(`new.${field}`), `authority guard missing ${field}`)
}
assert.match(migration, /before update on public\.profiles/i)

// The exact active school onboarding signatures require canonical teacher authority.
const canonicalConnect = migration.match(/create or replace function public\.connect_teacher_to_school\(p_school_id uuid, p_level text default null\)[\s\S]*?\$\$;/i)?.[0] ?? ''
const directoryConnect = migration.match(/create or replace function public\.connect_teacher_to_directory_school\(p_directory_id uuid,p_level text default null\)[\s\S]*?\$\$;/i)?.[0] ?? ''
for (const fn of [canonicalConnect, directoryConnect]) {
  assert.match(fn, /select public\.get_my_role\(\) into v_role/i)
  assert.match(fn, /v_role is distinct from 'teacher'/i)
  assert.match(fn, /teacher_role_required/i)
}

// Auth may consume the School Engine reconciliation path, but must never become
// a competing canonical-school creation authority.
assert.match(directoryConnect, /public\.school_identity_candidates/i)
assert.match(directoryConnect, /school_identity_review_required/i)
assert.doesNotMatch(directoryConnect, /insert\s+into\s+public\.schools\s*\(/i)
assert.doesNotMatch(directoryConnect, /'schools_directory'\s*,\s*d\.id::text/i)

// Admin approval is explicit and cannot overwrite another established role lane.
const approveAdmin = migration.match(/create or replace function public\.approve_school_admin_join_request[\s\S]*?\$\$;/i)?.[0] ?? ''
assert.match(approveAdmin, /v_requester_role is not null and v_requester_role<>'admin'/i)
assert.match(approveAdmin, /requester_role_conflict/i)

// OAuth/session callback: strict intent, signup-vs-signin, recovery, safe next, DB access state.
assert.match(callback, /safeIntent/)
assert.match(callback, /intent === 'signup'/)
assert.match(callback, /claim_my_initial_role/)
assert.match(callback, /intent === 'signin'/)
assert.match(callback, /account_unregistered/)
assert.match(callback, /intent === 'recovery'/)
assert.match(callback, /\/auth\/reset-password/)
assert.match(callback, /get_my_auth_access_state/)
assert.match(callback, /get_my_onboarding_state/)
assert.match(callback, /roleCanVisit/)
assert.match(callback, /scope: 'auth_journey'/)

// Email/password signup uses display metadata only and server-owned role claim.
for (const signup of [teacherSignup, parentSignup, globalSignup]) {
  assert.match(signup, /emailRedirectTo: callback/)
  assert.match(signup, /claim_my_initial_role/)
  assert.doesNotMatch(signup, /data:\s*\{\s*role:/)
  assert.doesNotMatch(signup, /localStorage\.setItem\('vs_role'/)
}
assert.match(globalSignup, /p_role: 'global_user'/)
assert.doesNotMatch(globalSignup, /\.from\('profiles'\)\.insert/)

// Login page selection is intent/UI only; DB role + onboarding resolver choose destination.
assert.match(login, /get_my_auth_access_state/)
assert.match(login, /get_my_onboarding_state/)
assert.match(login, /roleCanVisit/)
assert.doesNotMatch(login, /actualRole !== expectedRole/)
assert.doesNotMatch(login, /localStorage\.setItem\('vs_role'/)

// Every product workspace has one route-role contract; www canonicalizes to apex.
for (const pair of [
  ["'/teacher'", "'teacher'"],
  ["'/parent'", "'parent'"],
  ["'/student'", "'student'"],
  ["'/admin'", "'admin'"],
  ["'/global'", "'global_user'"],
]) {
  assert.ok(routing.includes(`${pair[0]}: ${pair[1]}`), `missing route contract ${pair.join(' -> ')}`)
}
assert.match(middleware, /get_my_auth_access_state/)
assert.match(middleware, /get_my_onboarding_state/)
assert.match(middleware, /www\.vibeschool\.co\.ke/)
assert.match(middleware, /vibeschool\.co\.ke/)
assert.match(middleware, /Cache-Control/)

// Recovery/error/logout/PWA boundaries.
assert.match(forgot, /resetPasswordForEmail/)
assert.match(forgot, /intent=recovery/)
assert.match(reset, /updateUser\(\{ password \}\)/)
assert.match(reset, /fetch\('\/auth\/logout'/)
assert.match(errorPage, /authority_resolution_failed/)
assert.match(errorPage, /recovery_session_missing/)
assert.match(logout, /supabase\.auth\.signOut\(\{\s*scope:\s*['"]local['"]\s*\}\)/)
assert.doesNotMatch(logout, /supabase\.auth\.signOut\(\)/)
assert.match(logout, /Cache-Control/)
assert.match(sw, /url\.pathname\.startsWith\('\/auth\/'\)/)
assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/)

console.log('Auth & onboarding authority contract: PASS')
