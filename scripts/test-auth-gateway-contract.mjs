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
const authorityMigration = read('supabase/migrations/20260816144500_auth_gateway_authority_hardening.sql')
const oauthMigration = read('supabase/migrations/20260816150500_auth_oauth_initial_role_claim.sql')

requireText('middleware', middleware, "supabase.auth.getUser()")
requireText('middleware', middleware, "supabase.rpc('get_my_auth_access_state')")
requireText('middleware', middleware, "requiredRoleForPath(pathname)")
requireText('middleware', middleware, "accountStatus === 'restricted'")
forbidText('middleware', middleware, "request.cookies.get('vibe_role')")

requireText('routing', routing, "value.startsWith('//')")
requireText('routing', routing, "decoded.includes('\\\\')")
requireText('routing', routing, 'requiredRoleForPath')

requireText('oauth callback', callback, "supabase.auth.exchangeCodeForSession(code)")
requireText('oauth callback', callback, "supabase.rpc('get_my_auth_access_state')")
requireText('oauth callback', callback, "supabase.rpc('claim_initial_oauth_role'")
requireText('oauth callback', callback, "OAUTH_SELF_CLAIM_ROLES")
requireText('oauth callback', callback, "await supabase.auth.signOut()")
forbidText('oauth callback', callback, 'Date.parse(user.created_at)')
forbidText('oauth callback', callback, "FIRST_ACCESS: Record<string, string> = {\n  teacher: '/teacher/onboarding/school',\n  parent: '/parent/students',\n  student:")

requireText('password reset', reset, 'exchangeCodeForSession(code)')
requireText('password reset', reset, 'supabase.auth.updateUser({ password })')
requireText('password reset', reset, 'await supabase.auth.signOut()')
requireText('password reset', reset, 'autoComplete="new-password"')
forbidText('password reset', reset, 'ROLE_BACK')

requireText('authority migration', authorityMigration, 'create or replace function public.get_my_auth_access_state()')
requireText('authority migration', authorityMigration, 'revoke all on function public.get_my_role() from anon;')
requireText('authority migration', authorityMigration, "when v_requested_role in ('teacher','parent','student','global_user')")

requireText('oauth role migration', oauthMigration, "p_requested_role not in ('teacher', 'parent', 'global_user')")
requireText('oauth role migration', oauthMigration, "v_provider is distinct from 'google'")
requireText('oauth role migration', oauthMigration, 'and p.role is null')
requireText('oauth role migration', oauthMigration, 'revoke all on function public.claim_initial_oauth_role(text) from anon;')
requireText('oauth role migration', oauthMigration, 'grant execute on function public.claim_initial_oauth_role(text) to authenticated;')

requireText('service worker', sw, "const STATIC_ROUTES = ['/offline.html']")
requireText('service worker', sw, "if (url.pathname.startsWith('/auth/')) return")
forbidText('service worker', sw, "STATIC_ROUTES = ['/login'")

if (failures.length) {
  console.error('Auth gateway contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Auth gateway contract passed.')
