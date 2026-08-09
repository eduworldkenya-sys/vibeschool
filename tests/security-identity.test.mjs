import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const hqClient = read('lib/hq/supabase.ts')
const hqLogin = read('app/hq/login/page.tsx')
const hqReset = read('app/hq/reset-password/page.tsx')
const ownerRecovery = read('app/api/hq/auth/recovery/route.ts')
const securityApi = read('app/api/hq/security/users/route.ts')
const adminReset = read('app/admin/reset-password/page.tsx')
const accountReset = read('app/account/reset-password/page.tsx')
const sessionMigration = read('supabase/migrations/20260810004500_security_identity_session_controls.sql')

test('HQ auth uses an isolated browser storage namespace', () => {
  assert.match(hqClient, /vibeschool-hq-auth/)
  assert.match(hqClient, /createClient/)
})

test('HQ login never falls back to the ordinary product Supabase client', () => {
  assert.match(hqLogin, /@\/lib\/hq\/supabase/)
  assert.doesNotMatch(hqLogin, /from\s+["']@\/lib\/supabase["']/)
  assert.match(hqLogin, /hq_check_owner_access/)
  assert.match(hqLogin, /signOut\(\{\s*scope:\s*["']local["']/)
})

test('HQ recovery re-checks platform owner authority', () => {
  assert.match(hqReset, /hq_check_owner_access/)
  assert.match(hqReset, /exchangeCodeForSession/)
  assert.match(hqReset, /password\.length\s*>=\s*12/)
})

test('HQ recovery initiation derives owner identity from the database', () => {
  assert.match(ownerRecovery, /platform_owners/)
  assert.match(ownerRecovery, /GENERIC/)
  assert.doesNotMatch(ownerRecovery, /gilowincinvestment@gmail\.com/i)
  assert.doesNotMatch(ownerRecovery, /HQ_OWNER_EMAIL/)
})

test('Security account controls protect platform owner from generic destructive actions', () => {
  assert.match(securityApi, /isPlatformOwner/)
  assert.match(securityApi, /platform_owner_protected/)
  assert.match(securityApi, /hq_service_revoke_user_sessions/)
  assert.match(securityApi, /password_recovery/)
})

test('all product recovery pages require strong passwords and consume recovery codes', () => {
  for (const source of [adminReset, accountReset]) {
    assert.match(source, /exchangeCodeForSession/)
    assert.match(source, /password\.length\s*<\s*12|password\.length\s*>=\s*12/)
    assert.match(source, /updateUser\(\{\s*password\s*\}\)/)
  }
})

test('session revocation function is service-role only', () => {
  assert.match(sessionMigration, /revoke all on function public\.hq_service_revoke_user_sessions\(uuid\) from public, anon, authenticated/i)
  assert.match(sessionMigration, /grant execute on function public\.hq_service_revoke_user_sessions\(uuid\) to service_role/i)
  assert.match(sessionMigration, /update auth\.refresh_tokens/i)
  assert.match(sessionMigration, /delete from auth\.sessions/i)
})
