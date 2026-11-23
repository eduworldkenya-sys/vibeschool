// Regression contract for first-phase public entry integration (#1984).
// Run: node --test scripts/test-unified-entry-continuity.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = file => readFileSync(file, 'utf8')
const login = read('app/login/[role]/page.tsx')
const join = read('app/join/JoinForm.tsx')
const joinPage = read('app/join/page.tsx')
const tutor = read('app/vibetutor/post-request/page.tsx')
const callback = read('app/auth/callback/route.ts')
const studentSignup = read('app/signup/student/SchoolSignupForm.tsx')
const studentPage = read('app/signup/student/page.tsx')
const independent = read('app/signup/student/independent/page.tsx')

test('learner Google login never requests first-time signup', () => {
  assert.match(login, /callback\.searchParams\.set\('intent', 'signin'\)/)
})

test('signup link carries safe origin intent to join', () => {
  assert.match(login, /next=\$\{encodeURIComponent\(requestedRedirect\)\}/)
  assert.match(joinPage, /safeInternalPath\(searchParams\?\.next\)/)
  assert.match(join, /safeInternalPath\(initialNext\)/)
})

test('email signup and OAuth share the same validated callback path', () => {
  assert.match(join, /emailRedirectTo: callback\(\)/)
  assert.match(join, /redirectTo: callback\(\)/)
  assert.match(join, /roleCanVisit\(role, requestedDestination\)/)
  assert.match(callback, /roleCanVisit\(role, next\)/)
})

test('return to source only after canonical onboarding is ready', () => {
  assert.match(join, /next\.state === 'ready'/)
  assert.match(login, /state === 'ready' && requested/)
})

test('tuition request persists and restores preferred times', () => {
  assert.match(tutor, /dayparts\?: DayPart\[\]/)
  assert.match(tutor, /setDayparts\(draft\.dayparts \|\| \[\]\)/)
  assert.match(tutor, /days, budget, phone, dayparts, publicPreview/)
})

test('student signup keeps validated origin through Google or school-code onboarding', () => {
  assert.match(studentPage, /safeInternalPath\(params.next\)/)
  assert.match(studentSignup, /roleCanVisit\('student', safeNext\)/)
  assert.match(studentSignup, /callback.searchParams.set\('next', studentNext\)/)
  assert.match(studentSignup, /createdAccount.signedIn \? \(studentNext \|\| '\/student'\)/)
  assert.match(callback, /signup\/student\/independent\?next=/)
  assert.match(independent, /safeInternalPath\(new URLSearchParams\(window.location.search\).get\('next'\)\)/)
})
