import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const callback = readFileSync('app/auth/callback/route.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20261112091500_auth_new_user_role_integrity.sql', 'utf8')
assert.match(migration, /alter table public\.profiles alter column role drop default/i)
assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'role'/i)
assert.match(migration, /insert into public\.profiles[\s\S]*?null,[\s\S]*?'active'/i)
assert.match(callback, /intent === 'signup' && requestedRole && access\.role && access\.role !== requestedRole/)
assert.match(callback, /signup_role_conflict[\s\S]*?supabase\.auth\.signOut\(\)[\s\S]*?authError\(req, 'signup_role_conflict'/)

const code = ts.transpileModule(callback, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const dashboards = { teacher: '/teacher/pulse', student: '/student', parent: '/parent', admin: '/admin' }

async function journey({ intent, requestedRole, actualRole, reasonCode = 'OK' }) {
  let role = actualRole
  let signedOut = 0
  let claims = 0
  let onboardingCalls = 0
  const client = {
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      getUser: async () => ({ data: { user: { id: 'fixture-user', email: 'learner@example.test' } }, error: null }),
      signOut: async () => { signedOut++; return { error: null } },
    },
    rpc: async (name, args) => {
      if (name === 'get_my_auth_access_state') return { data: { role, account_status: 'active', is_anonymized: false, reason_code: role ? 'OK' : reasonCode }, error: null }
      if (name === 'claim_my_initial_role') { claims++; role = args.p_role; return { data: role, error: null } }
      if (name === 'get_my_onboarding_state') { onboardingCalls++; return { data: { state: 'ready', destination: dashboards[role] }, error: null } }
      throw Error('Unexpected RPC: ' + name)
    },
  }
  const mockRedirect = url => {
    const result = { url: String(url), cookies: { set: () => {} }, headers: { set: () => {} } }
    return result
  }
  const exports = {}
  runInNewContext(code, {
    exports,
    URL,
    crypto: { randomUUID: () => 'fixture-flow' },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture', INDEPENDENT_LEARNER_PUBLIC_GOOGLE_ENABLED: 'false' } },
    console: { info: () => {} },
    require: name => ({
      '@supabase/ssr': { createServerClient: () => client },
      '@supabase/supabase-js': { createClient: () => { throw Error('Not needed by this test') } },
      'next/server': { NextResponse: { redirect: mockRedirect } },
      'next/headers': { cookies: () => ({ getAll: () => [], set: () => {} }) },
      '@/lib/auth-routing': { AUTH_DASHBOARDS: dashboards, safeInternalPath: path => path?.startsWith('/') && !path.startsWith('//') ? path : null, roleCanVisit: (r, path) => !['/student', '/teacher', '/parent', '/admin'].some(prefix => path.startsWith(prefix)) || path.startsWith('/' + r) },
    })[name] ?? (() => { throw Error('Unexpected import: ' + name) })(),
  })
  const url = new URL('https://vibeschool.co.ke/auth/callback')
  url.searchParams.set('code', 'fixture-code')
  url.searchParams.set('intent', intent)
  if (requestedRole) url.searchParams.set('role', requestedRole)
  url.searchParams.set('flow', 'test-flow')
  const response = await exports.GET({ nextUrl: url })
  return { path: new URL(response.url).pathname + new URL(response.url).search, signedOut, claims, onboardingCalls }
}

// User selects learner signup but Google authenticates an existing teacher.
const mismatch = await journey({ intent: 'signup', requestedRole: 'student', actualRole: 'teacher' })
assert.equal(mismatch.path, '/auth/error?reason=signup_role_conflict')
assert.equal(mismatch.signedOut, 1)
assert.equal(mismatch.claims, 0)
assert.equal(mismatch.onboardingCalls, 0)

// Existing teacher account can still sign in as a teacher.
const teacherSignin = await journey({ intent: 'signin', requestedRole: 'teacher', actualRole: 'teacher' })
assert.equal(teacherSignin.path, '/teacher/pulse')
assert.equal(teacherSignin.signedOut, 0)

// Existing independent/school learner remains a learner, not a teacher.
const student = await journey({ intent: 'signup', requestedRole: 'student', actualRole: 'student' })
assert.equal(student.path, '/student')
assert.equal(student.signedOut, 0)

// New learner without Google self-service permission must fail closed, never become a teacher.
const unclaimed = await journey({ intent: 'signup', requestedRole: 'student', actualRole: null, reasonCode: 'ROLE_UNCLAIMED' })
assert.equal(unclaimed.path, '/auth/error?reason=role_required')
assert.equal(unclaimed.claims, 0)

// New teacher remains eligible for the explicit teacher role-claim RPC.
const newTeacher = await journey({ intent: 'signup', requestedRole: 'teacher', actualRole: null, reasonCode: 'ROLE_UNCLAIMED' })
assert.equal(newTeacher.path, '/teacher/pulse')
assert.equal(newTeacher.claims, 1)

console.log('Signup role-authority and redirect regression tests passed.')
