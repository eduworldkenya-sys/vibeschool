import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, process, URL, console, crypto,
    require: name => dependencies[name] ?? require(name),
  }, { filename: path })
  return exports
}

const policy = load('lib/learner/independent-signup.ts')
const learner = {
  id: 'learner',
  email: 'Learner@example.com',
  email_confirmed_at: '2026-11-07T12:00:00Z',
  identities: [{ provider: 'google', identity_data: { email: 'learner@example.com', email_verified: true } }],
}
assert.equal(policy.verifiedGoogleEmail(learner), 'learner@example.com')
for (const user of [
  { ...learner, identities: [], user_metadata: { email_verified: true, provider: 'google' } },
  { ...learner, email_confirmed_at: null },
  { ...learner, email: 'other@example.com' },
  { ...learner, identities: [{ provider: 'google', identity_data: { email: learner.email, email_verified: false } }] },
]) assert.equal(policy.verifiedGoogleEmail(user), null)

const { learnerConsentActor } = load('lib/learner/guardian-consent.ts', { './independent-signup': policy })
const request = {
  nextUrl: new URL('https://vibeschool.co.ke/api/learner/consent?mode=independent'),
  headers: { get: () => 'Bearer test-session' },
}
const pending = { role: null, account_status: 'active', is_anonymized: false, school_id: null }
function admin({ profile = pending, student = null, membership = null, user = learner } = {}) {
  const rows = { profiles: profile, students: student, school_members: membership }
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      assert.ok(table in rows, 'Actor only reads canonical identity tables')
      const query = { select: () => query, eq: () => query, is: () => query, limit: () => query,
        maybeSingle: async () => ({ data: rows[table], error: null }) }
      return query
    },
  }
}
delete process.env.LEARNER_INDEPENDENT_GOOGLE_ENABLED
assert.equal(await learnerConsentActor(request, admin()), null)
process.env.LEARNER_INDEPENDENT_GOOGLE_ENABLED = 'true'
assert.equal((await learnerConsentActor(request, admin())).email, 'learner@example.com')
for (const facts of [
  { profile: null },
  { profile: { ...pending, role: 'parent' } },
  { profile: { ...pending, role: 'student' } },
  { profile: { ...pending, account_status: 'restricted' } },
  { profile: { ...pending, is_anonymized: true } },
  { profile: { ...pending, school_id: 'school' } },
  { student: { id: 'student' } },
  { membership: { profile_id: learner.id } },
]) assert.equal(await learnerConsentActor(request, admin(facts)), null)

let verified = true
let access = { role: null, account_status: 'active', is_anonymized: false, reason_code: 'ROLE_UNCLAIMED' }
const calls = []
const { GET } = load('app/auth/callback/route.ts', {
  'next/server': { NextResponse: { redirect: url => ({ url, cookies: { set() {} }, headers: new Map() }) } },
  'next/headers': { cookies: () => ({ getAll: () => [] }) },
  '@supabase/ssr': { createServerClient: () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      getUser: async () => ({ data: { user: learner }, error: null }),
    },
    rpc: async name => { calls.push(name); return { data: access, error: null } },
  }) },
  '@/lib/auth-routing': { AUTH_DASHBOARDS: { student: '/student' }, roleCanVisit: () => true, safeInternalPath: path => path },
  '@/lib/learner/guardian-consent': { consentEnabled: () => verified },
  '@/lib/learner/independent-signup': policy,
})
const callback = { nextUrl: new URL('https://vibeschool.co.ke/auth/callback?intent=signup&role=student&code=test&flow=test&next=/student') }
assert.equal((await GET(callback)).url.pathname, policy.INDEPENDENT_SIGNUP_PATH)
verified = false
assert.equal((await GET(callback)).url.searchParams.get('reason'), 'role_required')
verified = true
access = { ...access, reason_code: 'AMBIGUOUS_LEARNER_IDENTITY' }
assert.equal((await GET(callback)).url.searchParams.get('reason'), 'identity_conflict')
assert.ok(calls.every(name => name === 'get_my_auth_access_state'), 'Pending signup must never claim a learner role')
console.log('Independent Google signup contract passed.')

const writes = []
const events = []
let deliver = true
const { POST } = load('app/api/learner/consent/route.ts', {
  '@/lib/learner/guardian-consent': {
    adminClient: () => ({
      from(table) {
        assert.equal(table, 'learner_guardian_consent_requests')
        const query = {
          update: () => query, eq: () => query, lt: () => query, select: () => query,
          in: () => query, limit: () => query, gte: () => query,
          maybeSingle: async () => ({ data: null }),
          insert: row => { writes.push(row); return query },
          single: async () => ({ data: { id: 'request', updated_at: '2026-11-07T12:00:00Z' } }),
        }
        return query
      },
    }),
    learnerConsentActor: async () => ({ user: learner, independent: true, email: 'learner@example.com' }),
    consentEnabled: () => true,
    json: (body, status) => ({ body, status }),
    validEmail: value => typeof value === 'string' ? value : null,
    CONSENT_PURPOSE: 'personal_learning', CONSENT_VERSION: 'test',
    recordEvent: async (_admin, _id, kind) => events.push(kind),
    inviteGuardian: async () => { if (!deliver) throw new Error('mail unavailable') },
  },
})
const body = {
  learner_email: 'ignored@example.com', guardian_email: 'guardian@example.com',
  guardian_name: 'Test Guardian', guardian_relationship: 'legal_guardian',
  acknowledge_processing: true,
}
const submit = payload => POST({ json: async () => payload })
assert.equal((await submit({ ...body, guardian_email: 'learner@example.com' })).status, 400)
assert.equal(writes.length, 0)
assert.equal((await submit(body)).status, 201)
assert.equal(writes[0].learner_user_id, learner.id)
assert.equal(writes[0].learner_email, 'learner@example.com')
assert.equal(writes[0].student_id, null)
assert.equal(writes[0].learner_token_hash, null)
assert.equal(writes[0].status, 'pending')
assert.deepEqual(events, ['requested', 'learner_email_verified'])
deliver = false
assert.match((await submit(body)).body.message, /resend/)
console.log('Pending consent uses verified Google email and recovers from mail failure.')
