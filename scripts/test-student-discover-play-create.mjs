import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const home = read('components/student/StudentHomeDesk.tsx')
const learn = read('app/student/study/page.tsx')
const nav = read('components/student/BottomNav.tsx')
const explore = read('app/student/explore/page.tsx')
const play = read('app/student/funhub/page.tsx')
const create = read('app/student/create/page.tsx')
const projects = read('app/student/projects/independent/page.tsx')

test('Discover, Play and Create are reachable from learner Home, Learn and More navigation', () => {
  for (const route of ['/student/explore', '/student/funhub', '/student/create']) {
    assert.ok(home.includes(route), 'Home missing ' + route)
    assert.ok(learn.includes(route), 'Learn missing ' + route)
    assert.ok(nav.includes(route), 'More menu missing ' + route)
  }
})

test('Explore relies on the canonical published Learn catalogue rather than a parallel book source', () => {
  assert.match(explore, /fallbackSubjectGroups\(grade\)/)
  assert.match(explore, /return '\/learn'/)
  assert.doesNotMatch(explore, /supabase\.from/)
})

test('FunHub has playable, locked self-check rounds and never claims exam scores', () => {
  assert.doesNotMatch(play, /Coming Soon/)
  assert.match(play, /if \(chosen !== null \|\| !question \|\| complete\) return/)
  assert.match(play, /disabled=\{chosen !== null\}/)
  assert.match(play, /index \+ 1 === questions\.length/)
  assert.match(play, /not saved as school marks or mastery/)
  const questions = [...play.matchAll(/answers: \[([^\]]+)\], correct: (\d+)/g)]
  assert.equal(questions.length, 9, 'Three actual questions per game required')
  for (const [, answerList, correctIndex] of questions) {
    assert.equal((answerList.match(/'[^']*'/g) ?? []).length, 4)
    assert.ok(Number(correctIndex) >= 0 && Number(correctIndex) < 4)
  }
})

test('Create uses existing private projects; templates never bypass owner filtering', () => {
  assert.match(create, /projects\/independent\?template=/)
  assert.match(projects, /independent_owner_profile_id/)
  assert.match(projects, /new URLSearchParams\(window\.location\.search\)/)
  assert.match(projects, /\.eq\("independent_owner_profile_id", userId\)/)
  assert.match(create, /Sharing with other people is not enabled here/)
})
