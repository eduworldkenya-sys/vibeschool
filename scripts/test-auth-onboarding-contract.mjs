import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const callback = read('app/auth/callback/route.ts')
const middleware = read('middleware.ts')
const migration = read('supabase/migrations/20260816114500_auth_identity_role_authority_hardening.sql')
const adminMigration = read('supabase/migrations/20260816121500_auth_admin_registration_authority_hardening.sql')
const teacherSignup = read('app/signup/teacher/page.tsx')
const parentSignup = read('app/signup/parent/page.tsx')
const login = read('app/login/[role]/page.tsx')
const sw = read('public/sw.js')
const errorPage = read('app/auth/error/page.tsx')
const logout = read('app/auth/logout/route.ts')

// Identity / role authority
assert.match(migration, /alter table public\.profiles alter column role drop default/i)
assert.match(migration, /values \([\s\S]*?null,[\s\S]*?'active'[\s\S]*?\)/i)
assert.doesNotMatch(migration, /new\.raw_user_meta_data->>'role'/i)
assert.match(migration, /p_role not in \('teacher', 'parent', 'global_user'\)/i)
assert.doesNotMatch(migration.match(/create or replace function public\.claim_my_initial_role[\s\S]*?\$\$;/i)?.[0] ?? '', /'admin'/i)
assert.match(migration, /select p\.role[\s\S]*from public\.profiles p[\s\S]*where p\.id = auth\.uid\(\)/i)
assert.doesNotMatch(migration.match(/create or replace function public\.get_my_role[\s\S]*?\$\$;/i)?.[0] ?? '', /school_members/i)

// Signup vs sign-in semantics
assert.match(callback, /if \(!role && intent === 'signup'\)/)
assert.match(callback, /claim_my_initial_role/)
assert.match(callback, /if \(!role && intent === 'signin'\)/)
assert.match(callback, /account_unregistered/)
assert.match(callback, /nextMatchesRole/)
assert.match(callback, /startsWith\('\/\/'\)/)
assert.match(teacherSignup, /emailRedirectTo: callback/)
assert.match(parentSignup, /emailRedirectTo: callback/)
assert.match(teacherSignup, /claim_my_initial_role/)
assert.match(parentSignup, /claim_my_initial_role/)
assert.doesNotMatch(teacherSignup, /data:\s*\{\s*role:/)
assert.doesNotMatch(parentSignup, /data:\s*\{\s*role:/)

// Existing account role wins over the selected login UI.
assert.match(login, /get_my_role/)
assert.match(login, /get_my_onboarding_state/)
assert.doesNotMatch(login, /actualRole !== expectedRole/)
assert.doesNotMatch(login, /localStorage\.setItem\('vs_role'/)

// Protected routing uses one resolver and includes every product role.
for (const prefix of ['/teacher', '/admin', '/parent', '/student', '/global']) {
  assert.ok(middleware.includes(`'${prefix}'`), `missing protected prefix ${prefix}`)
}
assert.match(middleware, /get_my_onboarding_state/)
assert.match(middleware, /routeBelongsToRole/)
assert.match(middleware, /www\.vibeschool\.co\.ke/)
assert.match(middleware, /vibeschool\.co\.ke/)

// Derived school membership cannot manufacture a teacher role.
const ensureMember = migration.match(/create or replace function public\.ensure_school_member[\s\S]*?\$\$;/i)?.[0] ?? ''
assert.match(ensureMember, /new\.role = 'teacher'/i)

// Admin registration must be pending; approval is the authority transition.
const createAdmin = adminMigration.match(/create or replace function public\.create_school_with_admin[\s\S]*?\$\$;/i)?.[0] ?? ''
assert.match(createAdmin, /'pending'/i)
assert.doesNotMatch(createAdmin, /role\s*=\s*'admin'/i)
assert.doesNotMatch(createAdmin, /values\([^)]*'admin'/i)
assert.match(adminMigration, /approve_pending_school_registration/)
assert.match(adminMigration, /is_platform_owner\(\)/)

// Error, logout and PWA safety.
assert.match(errorPage, /authority_resolution_failed/)
assert.match(logout, /supabase\.auth\.signOut\(\)/)
assert.match(logout, /Cache-Control/)
assert.match(sw, /url\.pathname\.startsWith\('\/auth\/'\)/)
assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/)

console.log('Auth & onboarding hardening contract: PASS')
