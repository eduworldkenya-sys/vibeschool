import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const failures = []
const requireText = (name, source, token) => {
  if (!source.includes(token)) failures.push(`${name}: missing ${token}`)
}
const forbidText = (name, source, token) => {
  if (source.includes(token)) failures.push(`${name}: forbidden ${token}`)
}

const middleware = read('middleware.ts')
const callback = read('app/auth/callback/route.ts')
const reset = read('app/reset-password/page.tsx')
const routing = read('lib/auth-routing.ts')
const sw = read('public/sw.js')
const gatewayMigration = read('supabase/migrations/20260816144500_auth_gateway_authority_hardening.sql')
const reconcileMigration = read('supabase/migrations/20260816154000_auth_onboarding_authority_reconcile.sql')
const adminMigration = read('supabase/migrations/20260816152000_auth_admin_provisioning_approval.sql')

requireText('middleware', middleware, "supabase.auth.getUser()")
requireText('middleware', middleware, "supabase.rpc('get_my_auth_access_state')")
requireText('middleware', middleware, "requiredRoleForPath(pathname)")
requireText('middleware', middleware, "status === 'restricted'")
requireText('middleware', middleware, 'anonymized')
forbidText('middleware', middleware, "request.cookies.get('vibe_role')")

requireText('routing', routing, "value.startsWith('//')")
requireText('routing', routing, "decoded.includes('\\\\')")
requireText('routing', routing, 'requiredRoleForPath')
requireText('routing', routing, "'/global': 'global_user'")

requireText('oauth callback', callback, "supabase.auth.exchangeCodeForSession(code)")
requireText('oauth callback', callback, "supabase.rpc('get_my_auth_access_state')")
requireText('oauth callback', callback, "supabase.rpc('claim_my_initial_role'")
requireText('oauth callback', callback, "SELF_SERVICE_ROLES")
requireText('oauth callback', callback, "intent === 'signin'")
requireText('oauth callback', callback, "intent === 'signup'")
requireText('oauth callback', callback, "intent === 'recovery'")
requireText('oauth callback', callback, "await supabase.auth.signOut()")
requireText('oauth callback', callback, 'roleCanVisit')
forbidText('oauth callback', callback, 'Date.parse(user.created_at)')

requireText('password reset', reset, 'exchangeCodeForSession(code)')
requireText('password reset', reset, 'supabase.auth.updateUser({ password })')
requireText('password reset', reset, 'await supabase.auth.signOut()')
requireText('password reset', reset, 'autoComplete="new-password"')
forbidText('password reset', reset, 'ROLE_BACK')

// Current gateway access-state contract remains available.
requireText('gateway migration', gatewayMigration, 'create or replace function public.get_my_auth_access_state()')
requireText('gateway migration', gatewayMigration, 'revoke all on function public.get_my_role() from anon;')

// The later reconciliation migration is the final role-authority contract.
requireText('reconcile migration', reconcileMigration, 'alter table public.profiles alter column role drop default;')
requireText('reconcile migration', reconcileMigration, 'create or replace function public.claim_my_initial_role(p_role text)')
requireText('reconcile migration', reconcileMigration, "p_role not in ('teacher','parent','global_user')")
requireText('reconcile migration', reconcileMigration, "new.raw_user_meta_data->>'full_name'")
forbidText('reconcile migration', reconcileMigration, "raw_user_meta_data->>'role'")
requireText('reconcile migration', reconcileMigration, 'guard_profile_authority_fields')
requireText('reconcile migration', reconcileMigration, "new.role is distinct from old.role")
requireText('reconcile migration', reconcileMigration, "new.school_id is distinct from old.school_id")
requireText('reconcile migration', reconcileMigration, "v_role is distinct from 'teacher'")
requireText('reconcile migration', reconcileMigration, 'requester_role_conflict')

requireText('admin provisioning migration', adminMigration, "status = 'pending'")
requireText('admin provisioning migration', adminMigration, 'insert into public.school_admin_join_requests')
requireText('admin provisioning migration', adminMigration, 'coalesce(public.is_platform_owner(), false)')
requireText('admin provisioning migration', adminMigration, "role = 'admin'")
requireText('admin provisioning migration', adminMigration, 'revoke all on function public.create_school_with_admin')
forbidText('admin provisioning migration', adminMigration, "values(p_user_id,trim(p_full_name),v_school_id,'admin')")

requireText('service worker', sw, "const STATIC_ROUTES = ['/offline.html']")
requireText('service worker', sw, "if (url.pathname.startsWith('/auth/')) return")
forbidText('service worker', sw, "STATIC_ROUTES = ['/login'")

if (failures.length) {
  console.error('Auth gateway contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Auth gateway contract passed.')
