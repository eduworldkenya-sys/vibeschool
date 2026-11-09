import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(file, imports, env = {}) {
  const source = readFileSync(`app/signup/student/email/${file}.ts`, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports, process: { env }, URL, Map, require: name => {
    assert.ok(name in imports, `Unexpected import ${name}`)
    return imports[name]
  } })
  return exports
}

const email = 'adult-test@example.test'
const env = { SUPABASE_SERVICE_ROLE_KEY: 'fixture', NODE_ENV: 'production', INDEPENDENT_LEARNER_PILOT_EMAILS: email }
const config = load('config', {}, env)
const user = { id: 'fixture-id', email, email_confirmed_at: '2026-11-09T08:00:00Z' }
const access = { authenticated: true, account_status: 'active', is_anonymized: false, reason_code: 'ROLE_UNCLAIMED' }
let allowed = true
let schoolLearner = false
let invalidCode = false
let suspended = false
let sends = 0
let verifies = 0
let writes = 0
let inserts = 0
const jar = { getAll: () => [], set: () => { writes++ } }
const db = {
  from(table) {
    if (table === 'students') return { select: () => ({ eq: () => ({ limit: () => ({
      maybeSingle: async () => ({ data: schoolLearner ? { id: 'school-id' } : null }),
    }) }) }) }
    assert.equal(table, 'independent_learner_identities')
    return {
      upsert: async (row, options) => {
        assert.equal(row.user_id, user.id)
        assert.equal(row.learner_email_verified_at, user.email_confirmed_at)
        assert.equal(Object.keys(row).length, 2)
        assert.equal(options.ignoreDuplicates, true)
        inserts++
        return {}
      },
      select: () => ({ eq: () => ({
        maybeSingle: async () => ({ data: { account_state: suspended ? 'suspended' : 'restricted', learner_email_verified_at: user.email_confirmed_at } }),
      }) }),
    }
  },
}

const server = load('server', {
  'server-only': {},
  'next/headers': { cookies: () => jar },
  '@supabase/supabase-js': { createClient: () => db },
  './config': config,
  '@supabase/ssr': { createServerClient: (_url, _key, options) => {
    assert.equal(options.cookieOptions.name, 'vs-independent-email-pilot')
    assert.equal(options.cookieOptions.path, '/signup/student/email')
    assert.equal(options.cookieOptions.httpOnly, true)
    assert.equal(options.cookieOptions.secure, true)
    return {
      rpc: async name => {
        assert.equal(name, 'get_my_auth_access_state')
        return { data: { ...access, reason_code: allowed ? access.reason_code : 'STUDENT_READY' } }
      },
      auth: {
        signInWithOtp: async request => {
          sends++
          assert.equal(request.email, email)
          assert.equal(request.options.emailRedirectTo, 'https://vibeschool.co.ke/signup/student/email/confirm')
          return {}
        },
        verifyOtp: async request => {
          verifies++
          assert.equal(request.type, 'email')
          if (invalidCode) return { error: new Error('expired') }
          options.cookies.setAll([{ name: 'vs-independent-email-pilot', value: 'session', options: {} }])
          return { data: { user, session: {} } }
        },
        getUser: async () => ({ data: { user } }),
      },
    }
  } },
}, env)
const actions = load('actions', { './config': config, './server': server }, env)
const form = (address, token = '012345') => {
  const data = new FormData()
  data.set('email', address)
  data.set('code', token)
  return data
}

assert.equal(load('config', {}).emailPilotEnabled(), false)
assert.equal((await actions.sendLearnerEmail(form('other@example.test'))).email, undefined)
assert.equal(sends, 0)
assert.equal((await actions.sendLearnerEmail(form(` ${email.toUpperCase()} `))).email, email)
assert.equal(sends, 1)
assert.ok((await actions.verifyLearnerEmail(form(email, 'invalid'))).error)
assert.equal(verifies, 0)
invalidCode = true
assert.ok((await actions.verifyLearnerEmail(form(email))).error)
invalidCode = false
allowed = false
assert.ok((await actions.verifyLearnerEmail(form(email))).error)
allowed = true
schoolLearner = true
assert.ok((await actions.verifyLearnerEmail(form(email))).error)
assert.equal(inserts, 0)
assert.equal(writes, 0, 'rejected authentication must not write a session cookie')
schoolLearner = false
assert.equal((await actions.verifyLearnerEmail(form(email))).signedIn, true)
assert.equal(inserts, 1)
assert.equal(writes, 1)
assert.equal(await actions.checkLearnerEmailSession(), true)
suspended = true
assert.equal(await actions.checkLearnerEmailSession(), false)
assert.ok((await actions.verifyLearnerEmail(form(email))).error)
assert.equal(writes, 1, 'a suspended identity cannot reopen a session')
console.log('Independent learner email signup and isolated session boundaries passed.')
