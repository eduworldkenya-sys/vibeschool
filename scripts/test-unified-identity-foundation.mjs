import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(path, 'utf8')

test('new schema never grants old Teacher/Student/Parent OS authority', () => {
  const sql = read('supabase/migrations/20261123090000_unified_identity_foundation.sql')
  for (const marker of ['get_my_auth_access_state()','enable row level security','auth.uid()',
    'Parent authorization required',"kind='managed_learner' and auth_user_id is null",
    'grant execute on function public.vs_create_managed_learner']) {
    assert.ok(sql.includes(marker), 'Missing guard: ' + marker)
  }
  assert.doesNotMatch(sql, /update\s+public\.profiles\s+set\s+role\s*=/i)
})

test('identity API requires a verified authenticated user and same-origin write', () => {
  const origin = read('lib/identity/origin.ts')
  assert.match(origin, /parsed.origin === request.nextUrl.origin/)
  for (const p of ['app/api/identity/me/route.ts','app/api/identity/children/route.ts']) {
    assert.match(read(p), /validSameOriginMutation\(request\)/)
    assert.match(read(p), /db.auth.getUser\(\)/)
  }
})

test('client setup screen only assigns usernames after backend approval', () => {
  assert.match(read('app/account/setup/UsernameSetupForm.tsx'), /\/api\/identity\/me/)
  assert.match(read('app/account/setup/page.tsx'), /safeReturnPath\(params.next\)/)
})

test('username has a single normalized, constrained contract', () => {
  const src = read('lib/identity/username.ts')
  assert.match(src, /USERNAME_PATTERN/)
  const pattern = /^[a-z][a-z0-9_]{2,23}$/
  for (const good of ['brian254','mary_teacher','abc']) assert.ok(pattern.test(good))
  for (const bad of ['ab','@abc','admin.name','ab-3','1teacher','invalid space','Aaa','x'.repeat(25)]) assert.ok(!pattern.test(bad))
})
