import fs from 'node:fs'
import assert from 'node:assert/strict'

const middleware = fs.readFileSync('middleware.ts', 'utf8')
const login = fs.readFileSync('app/login/page.tsx', 'utf8')
const errorPage = fs.readFileSync('app/auth/error/page.tsx', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260818201759_auth_onboarding_rpc_schema_visibility_repair.sql', 'utf8')

assert.match(errorPage, /href="\/login"/)
assert.match(login, /\/login\/teacher/)
assert.match(login, /\/login\/parent/)
assert.match(login, /\/login\/student/)
assert.match(login, /\/login\/global/)
assert.match(middleware, /PUBLIC_AUTH_ROUTES/)
assert.doesNotMatch(middleware, /pathname === '\/login'[\s\S]{0,240}NextResponse\.rewrite/)
assert.match(migration, /alter function public\.get_my_onboarding_state\(\) stable/i)
assert.match(migration, /grant execute on function public\.get_my_onboarding_state\(\) to authenticated, service_role/i)
assert.match(migration, /pg_notify\('pgrst','reload schema'\)/i)

console.log('Auth recovery routing contract: PASS')
