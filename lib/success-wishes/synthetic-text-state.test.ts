import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syntheticTextTransition } from './synthetic-text-state'

test('synthetic text: create request, accept and reveal; cannot skip acceptance', () => {
  assert.equal(syntheticTextTransition('compose', 'accept'), 'compose')
  assert.equal(syntheticTextTransition('compose', 'hide'), 'compose')
  const requested = syntheticTextTransition('compose', 'send')
  assert.equal(requested, 'request')
  assert.equal(syntheticTextTransition(requested, 'send'), 'request')
  assert.equal(syntheticTextTransition(requested, 'accept'), 'accepted')
})

test('synthetic text: hide is irreversible and repeated actions do not reveal content', () => {
  const hidden = syntheticTextTransition('request', 'hide')
  assert.equal(hidden, 'hidden')
  assert.equal(syntheticTextTransition(hidden, 'accept'), 'hidden')
  assert.equal(syntheticTextTransition(hidden, 'send'), 'hidden')
  assert.equal(syntheticTextTransition('accepted', 'hide'), 'hidden')
  assert.equal(syntheticTextTransition('accepted', 'accept'), 'accepted')
})
