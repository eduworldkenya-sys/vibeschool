import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { learnerDisplayName, learnerGreeting, studyDeskHeading } from '../lib/student/learner-welcome.ts'

const read = file => readFileSync(file, 'utf8')

test('first visit offers Start, saved reading offers Continue, and loading is neutral', () => {
  assert.equal(studyDeskHeading(true, 0), 'Your learning space')
  assert.equal(studyDeskHeading(false, 0), 'Start learning')
  assert.equal(studyDeskHeading(false, 1), 'Continue where you left off')
  assert.equal(studyDeskHeading(false, 3), 'Continue where you left off')
  assert.match(read('app/student/study/page.tsx'), /studyDeskHeading\(loading \|\| Boolean\(error\), workspace\?\.continueLearning\.length \?\? 0\)/)
})

test('greeting uses the verified real first name in Nairobi time', () => {
  assert.equal(learnerGreeting(new Date('2026-11-15T05:00:00Z'), 'Jane Wanjiku'), 'Good morning, Jane')
  assert.equal(learnerGreeting(new Date('2026-11-15T11:00:00Z'), 'Amina Njeri'), 'Good afternoon, Amina')
  assert.equal(learnerGreeting(new Date('2026-11-15T19:00:00Z'), 'Jane'), 'Good evening, Jane')
  assert.equal(learnerGreeting(new Date('2026-11-15T05:00:00Z'), ''), 'Good morning')
  assert.equal(learnerGreeting(new Date('2026-11-15T05:00:00Z'), 'Learner'), 'Good morning')
  assert.equal(learnerDisplayName('Learner', '  Jane   Wanjiku  '), 'Jane Wanjiku')
  assert.equal(learnerDisplayName('Student', undefined, ''), '')
})

test('independent signup persists a verified name and lookup falls back to the provider name', () => {
  const signup = read('app/signup/student/independent/page.tsx')
  const grade = read('app/api/learner/independent/grade/route.ts')
  const home = read('app/api/learner/independent/home/route.ts')
  const identity = read('lib/student-context.tsx')
  const studentHome = read('app/student/page.tsx')

  assert.match(signup, /id="independent-learner-name"/)
  assert.match(signup, /JSON\.stringify\(\{ grade, name: name\.trim\(\) \}\)/)
  assert.match(grade, /learnerDisplayName\(submittedName, profile\.full_name, user\.user_metadata\?\.full_name/)
  assert.match(grade, /\.eq\('id', studentId\)\.eq\('profile_id', user\.id\)/)
  assert.match(home, /learnerDisplayName\(profile\.full_name, school\?\.\[0\]\?\.name, user\.user_metadata\?\.full_name/)
  assert.match(identity, /const name = learnerDisplayName\(home\.name\)/)
  assert.match(studentHome, /learnerGreeting\(new Date\(\), identity\.firstName\)/)
})

test('home only promotes twin continue suggestions when prior learning evidence exists', () => {
  const home = read('app/student/page.tsx')
  assert.match(home, /const suggestedAction = hasLearningEvidence \? data\?\.twin\.decision\.now : null/)
  assert.match(home, /suggestedAction\?\.title/)
  assert.match(home, /hasLearningEvidence \? 'Open Learn' : 'Start learning'/)
  assert.doesNotMatch(home, /\{greeting\(\), identity\.firstName\}/)
})
