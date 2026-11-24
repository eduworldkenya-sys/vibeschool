import test from 'node:test'
import assert from 'node:assert/strict'
import { audioSdp, validateMeshState } from './mesh-protocol.ts'

const valid = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 A1:B2\r\na=rtpmap:111 opus/48000/2\r\n'
const peer = { studentId: '11111111-1111-4111-8111-111111111111', epoch: 1, offer: null, answer: valid, speaking: false }
const other = { ...peer, studentId: '22222222-2222-4222-8222-222222222222' }
const state = { role: 'teacher', peers: [peer, other], fallback: false, expiresAt: '2026-11-24T20:00:00Z' }
const now = Date.parse('2026-11-24T19:00:00Z')
test('accepts only bounded, fingerprinted audio SDP', () => {
  assert.equal(audioSdp(valid), true)
  for (const bad of [valid + 'm=video 9 UDP/TLS/RTP/SAVPF 100\r\n', valid.replace('m=audio', 'm=application'),
    valid.replace('a=fingerprint:', 'a=other:'), valid + 'x'.repeat(24001)]) assert.equal(audioSdp(bad), false)
})
test('accepts distinct teacher edges and a single own learner edge', () => {
  assert.deepEqual(validateMeshState(state, true, now).peers, [peer, other])
  const own = { ...peer, offer: valid, answer: null }
  assert.deepEqual(validateMeshState({ ...state, role: 'learner', peers: [own] }, false, now).peers, [own])
})
test('rejects wrong roles, extra learner edges and SDP returned in the wrong direction', () => {
  assert.throws(() => validateMeshState(state, false, now))
  assert.throws(() => validateMeshState({ ...state, role: 'learner' }, false, now))
  assert.throws(() => validateMeshState({ ...state, peers: [{ ...peer, offer: valid }] }, true, now))
  assert.throws(() => validateMeshState({ ...state, role: 'learner', peers: [peer] }, false, now))
})
test('rejects expired or malformed state, duplicate peers, and multiple speaking grants', () => {
  assert.throws(() => validateMeshState(state, true, now + 3600001))
  assert.throws(() => validateMeshState({ ...state, expiresAt: 'bad' }, true, now))
  assert.throws(() => validateMeshState({ ...state, peers: [peer, peer] }, true, now))
  assert.throws(() => validateMeshState({ ...state, peers: [{ ...peer, epoch: -1 }] }, true, now))
  assert.throws(() => validateMeshState({ ...state, peers: [{ ...peer, speaking: true }, { ...other, speaking: true }] }, true, now))
  assert.throws(() => validateMeshState({ ...state, fallback: true }, true, now))
})
