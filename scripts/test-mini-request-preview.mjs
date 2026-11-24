import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const mini = read('components/public/MiniExplore.tsx')
const home = read('components/public/MiniHomeSection.tsx')
const page = read('app/explore/page.tsx')
const examples = read('lib/public/mini-examples.ts')
const live = read('components/public/MiniLiveRequests.tsx')
const explore = read('components/public/MiniLiveExplore.tsx')

function assertAuthenticUnavailable(source) {
  assert.match(source, /Publishing is not yet available/)
  assert.doesNotMatch(source, /MINI_EXAMPLES|EXAMPLE_REQUESTS|local-request-|local-answer-|Add to preview|setComments\(|setLiked\(|setRequests\(|<article|<button/)
}
test('Uncommissioned public surfaces show availability, never fabricated posts or actions', () => {
  assert.match(mini, /<MiniLiveExplore enabled=\{false\}/)
  assertAuthenticUnavailable(home)
  for(const source of [explore,live]) assert.doesNotMatch(source,/MINI_EXAMPLES|EXAMPLE_REQUESTS|local-request-|local-answer-|Add to preview/)
  for(const label of ['+ Create','Search Mini Lessons','For You','Following','New','Create Mini Lesson','Request an explanation']) assert.ok(explore.includes(label))
  assert.match(explore,/if \(!enabled\) return\s+let mounted/)
  assert.match(explore,/if \(!enabled \|\| !identityReady/)
  assert.match(explore,/event.preventDefault\(\)\s+if \(!enabled\) return/)
  assert.match(explore,/disabled=\{!enabled \|\| !viewer/)
  assert.match(live,/if\(!enabled\|\|busy\)return/)
  assert.match(live,/disabled=\{!enabled\|\|busy/)
  assert.doesNotMatch(examples, /MINI_EXAMPLES|Example History teacher|example-algebra-request/)
})
test('Live requests retain real actions and identity privacy behind existing gate', () => {
  assert.match(page, /NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true' \? <MiniLiveExplore/)
  assert.match(home, /NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'\) return <MiniLiveHome/)
  assert.match(live, /submitMiniRequest\(question,tags\)/)
  assert.match(live, /changeRequestSupport/)
  assert.match(live, /fetchMiniRequestAnswers/)
  assert.match(live, /Never include your name/)
})
test('Negative control rejects reintroduced sample content or simulated engagement', () => {
  assert.throws(() => assertAuthenticUnavailable(home+'\nconst MINI_EXAMPLES = []'))
  assert.throws(() => assertAuthenticUnavailable(home+'\nsetLiked([])'))
})
