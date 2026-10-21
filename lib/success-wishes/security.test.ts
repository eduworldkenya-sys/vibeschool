import test from 'node:test'
import assert from 'node:assert/strict'
import { accessHash, enabled, equalHash, hashSecret, messageExpiry, mediaPlaybackEnabled, staffReady, token } from './security'
import { field, object, retryKey, sameSavedTextSubmission, submission, uuid, WishError } from './contracts'

const valid = {
  schoolId: '00000000-0000-4000-8000-000000000001', admissionNumber: '1234',
  candidateName: 'Test Candidate', senderName: 'Test Sender', relationship: 'Parent',
  kind: 'text', text: 'We believe in you.', consent: true,
  idempotencyKey: 'a'.repeat(64),
}

test('retention is bounded by campaign and invalid policy fails closed', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const end = '2026-10-21T12:00:00.000Z'
  assert.equal(messageExpiry(60, end, now), end)
  assert.equal(messageExpiry(1, '2026-11-20T12:00:00Z', now), end)
  for (const days of [0, -1, 366, NaN, 1.1]) assert.throws(() => messageExpiry(days, end, now))
  for (const expiry of ['', 'not-a-date', '2026-10-19T12:00:00Z']) assert.throws(() => messageExpiry(60, expiry, now))
})
test('retry capabilities use 256 bits of formatted random material', () => {
  assert.equal(retryKey('a'.repeat(64)), 'a'.repeat(64))
  for (const invalid of ['a'.repeat(63), 'g'.repeat(64), '00000000-0000-4000-8000-000000000002']) {
    assert.throws(() => retryKey(invalid), WishError)
  }
})

test('sending stays closed unless explicit flag and both database credentials exist', () => {
  for (const env of [{}, { SUCCESS_WISHES_ENABLED: 'true' },
    { SUCCESS_WISHES_ENABLED: 'false', NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test' },
    { SUCCESS_WISHES_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://example.test' }]) {
    assert.equal(enabled(env), false)
  }
  assert.equal(enabled({SUCCESS_WISHES_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test'}), true)
})

test('inbox code matching tolerates only intended case/outer whitespace normalization', () => {
  assert.equal(accessHash(` ${'a'.repeat(32)} `), accessHash('A'.repeat(32)))
  assert.notEqual(accessHash('A'.repeat(31) + 'B'), accessHash('A'.repeat(32)))
  assert.notEqual(accessHash('A'.repeat(32)), hashSecret('A'.repeat(32)))
})

test('malformed and different capability hashes never authenticate', () => {
  for (const [a,b] of [['',''],['0'.repeat(63),'0'.repeat(63)],['g'.repeat(64),'g'.repeat(64)],['a'.repeat(64),'b'.repeat(64)]]) {
    assert.equal(equalHash(a,b), false)
  }
  assert.equal(equalHash(hashSecret('capability'), hashSecret('capability')), true)
  assert.match(token(), /^[a-f0-9]{64}$/)
})

test('submission rejects identity, consent, format and idempotency abuse', () => {
  assert.equal(submission(valid).text, valid.text)
  const invalid: unknown[] = [null, [], 'text', {...valid, schoolId:'../another-school'},
    {...valid, consent:'true'}, {...valid, consent:false}, {...valid, kind:'html'},
    {...valid, senderName:' '}, {...valid, candidateName:'\u0000'},
    {...valid, admissionNumber: 1234}, {...valid, idempotencyKey:'known-order'},
    {...valid, idempotencyKey:'00000000-0000-4000-8000-000000000002'},
    {...valid, idempotencyKey:'z'.repeat(64)},
    {...valid, text:'x'.repeat(2001)}, {...valid, text:'\u0000'}]
  for (const input of invalid) assert.throws(() => submission(input), WishError)
})

test('text is rendered as data and accepts ordinary Kenyan names and languages', () => {
  const result = submission({...valid, candidateName:'Wanjiku O’Neil', text:'Tunakuombea mafanikio. <script>alert(1)</script>'})
  assert.equal(result.text,'Tunakuombea mafanikio. <script>alert(1)</script>')
  // This validates transport only. Frontend must render as text, never innerHTML.
})

test('common parser boundaries reject arrays, null, controls and malformed UUIDs', () => {
  assert.throws(() => object([]), WishError)
  assert.throws(() => object(null), WishError)
  assert.throws(() => field('a\u0008b',1,20), WishError)
  assert.throws(() => uuid('00000000-0000-0000-0000-000000000000'), WishError)
  assert.equal(field('  hello  ',1,10),'hello')
})

test('text retry only recovers the exact saved sender and content', () => {
  const saved = {
    sender_name: 'Test Sender', relationship: 'Parent', format: 'text', body: 'We believe in you.',
  }
  assert.equal(sameSavedTextSubmission(saved, submission(valid)), true)
  assert.equal(sameSavedTextSubmission(saved, submission({...valid, text: 'Different message'})), false)
  assert.equal(sameSavedTextSubmission(saved, submission({...valid, senderName: 'Someone Else'})), false)
  assert.equal(sameSavedTextSubmission(saved, submission({...valid, relationship: 'Uncle'})), false)
  assert.equal(sameSavedTextSubmission({...saved, body: null}, submission(valid)), false)
  assert.equal(sameSavedTextSubmission(saved, submission({...valid, kind: 'voice'})), false)
})

test('staff onboarding is independently gated and never enables public sending', () => {
  const credentials = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key',
  }
  assert.equal(staffReady({ ...credentials, SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'false' }), false)
  assert.equal(staffReady({ ...credentials, SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'true' }), true)
  assert.equal(enabled({ ...credentials, SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'true' }), false)
  assert.equal(staffReady({ ...credentials, SUPABASE_SERVICE_ROLE_KEY: undefined, SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'true' }), false)
  assert.equal(staffReady({ ...credentials, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'true' }), false)
})


test('media emergency stop blocks playback independently of storage readiness', () => {
  const env = {
    SUCCESS_WISHES_ENABLED: 'true',
    SUCCESS_WISHES_MEDIA_CERTIFIED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-server-only',
  }
  assert.equal(mediaPlaybackEnabled(env), true)
  assert.equal(mediaPlaybackEnabled({ ...env, SUCCESS_WISHES_MEDIA_CERTIFIED: 'false' }), false)
  assert.equal(mediaPlaybackEnabled({ ...env, SUCCESS_WISHES_MEDIA_CERTIFIED: undefined }), false)
  assert.equal(mediaPlaybackEnabled({ ...env, SUCCESS_WISHES_ENABLED: 'false' }), false)
  assert.equal(mediaPlaybackEnabled({ ...env, SUPABASE_SERVICE_ROLE_KEY: undefined }), false)
})
