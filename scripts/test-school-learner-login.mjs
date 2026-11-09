import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync('lib/learner/school-login.ts', 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { schoolLearnerEmail, learnerLoginEmail } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

for (const [school, admission] of [['Gilgil-Township', ' ADM 001 '], ['school-b', 'ADM001'], ['a-uuid-school-id', 'a-uuid-student-id'], ['', 'ADM001']]) {
  const provisioned = schoolLearnerEmail(school, admission)
  assert.equal(learnerLoginEmail(admission, school || 'vs'), provisioned)
  assert.equal(learnerLoginEmail(provisioned.replace('@vs.internal', '')), provisioned)
  assert.equal(learnerLoginEmail(` ${provisioned.toUpperCase()} `), provisioned)
}
assert.notEqual(learnerLoginEmail('ADM001', 'School A'), learnerLoginEmail('ADM001', 'School B'))
assert.equal(learnerLoginEmail(' LEGACY 001 '), 'legacy001@vs.internal', 'existing unprefixed accounts still work')
assert.equal(learnerLoginEmail('teacher@example.com'), null, 'learner input cannot select an external email')
assert.equal(learnerLoginEmail('  '), null)
const login = fs.readFileSync('app/login/[role]/page.tsx', 'utf8')
const signup = fs.readFileSync('app/signup/student/SchoolSignupForm.tsx', 'utf8')
const route = fs.readFileSync('app/api/create-student-account/route.ts', 'utf8')
assert.match(login, /learnerLoginEmail\(identifier, schoolCode\)/)
assert.match(route, /schoolLearnerEmail\(school.subdomain \|\| school.id, admission\)/)
assert.match(signup, /Your sign-in ID/)
assert.match(signup, /setCreatedAccount/)
assert.match(login, /get_my_auth_access_state/)
assert.match(login, /get_my_onboarding_state/)
console.log('PASS learner provisioning/login parity, school isolation, legacy compatibility, input rejection and issued-ID handoff')
