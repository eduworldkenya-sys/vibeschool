import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const mini = read('components/public/MiniExplore.tsx')
const css = read('components/public/MiniExplore.module.css')

function assertRequestFlow(source) {
  assert.match(source, /Request an explanation/)
  assert.match(source, /Add to preview/)
  assert.match(source, /visibleRequests\.map\(item => <article/)
  assert.match(source, /toggleSupport\(item\.id\)/)
  assert.match(source, /onClick=\{\(\) => explainRequest\(item\.id\)\}/)
  assert.match(source, /replies: \[\.\.\.item\.replies/)
  assert.match(source, /view === 'request-detail'/)
  assert.match(source, /No explanations added to this preview yet/)
  assert.match(source, /This is a local interface preview\. Nothing is posted online/)
}

test('Request creation, discovery, Me too, multiple local explanations and detail are connected', () => {
  assertRequestFlow(mini)
  assert.match(mini, /tab !== 'Following'/)
  assert.match(mini, /request\.tags\.includes\(tag\)/)
  assert.match(mini, /Request this topic/)
})

test('Minors are never asked to disclose their names or identity publicly', () => {
  assert.match(mini, /Requests do not expose student identity/)
  assert.match(mini, /Do not include names, phone numbers or other personal details/)
  assert.doesNotMatch(mini, /fetch\(['"]\/api\/mini-requests/)
})

test('Request UI stays a disabled-mode preview rather than silently enabling publication', () => {
  assert.match(mini, /Publishing remains inactive/)
  assert.match(mini, /Public submission, recommendations and publishing are not active/)
  assert.match(mini, /Publish — not active/)
  assert.match(css, /\.requestCard\{/)
  assert.match(css, /\.requestDetail\{/)
  assert.match(css, /@media\(max-width:600px\)/)
})

test('Negative control: contract detects a missing request action', () => {
  assert.throws(() => assertRequestFlow(mini.replace('Request an explanation','')), /Request an explanation/)
})
