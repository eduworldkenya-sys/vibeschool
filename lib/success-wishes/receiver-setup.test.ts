import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { setupDigest, requireAdultSetup } from './receiver-setup'
import { POST, PATCH } from '../../app/api/success-wishes/receiver/verify/route'

const person = { phone_e164: '+254700000000', guardian_phone_e164: null,
  consent_route: 'adult' as const, consent_status: 'pending', setup_expires_at: '2030-01-01T00:00:00Z' }
test('setup capability is domain separated and requires 256-bit hex', () => {
  assert.match(setupDigest('a'.repeat(64)), /^[a-f0-9]{64}$/)
  assert.notEqual(setupDigest('a'.repeat(64)), 'a'.repeat(64))
  for (const token of [null, '', 'a'.repeat(63), 'A'.repeat(64), 'paid']) assert.throws(() => setupDigest(token))
})
test('pre-payment setup admits only provisioned adult recipients with an active capability', () => {
  assert.equal(requireAdultSetup(person, Date.parse('2026-01-01')), person)
  assert.doesNotThrow(() => requireAdultSetup({ ...person, consent_status: 'verified' }, Date.parse('2026-01-01')))
  for (const change of [{ consent_route: 'guardian' as const }, { consent_route: null },
    { consent_status: 'revoked' }, { setup_expires_at: null }, { setup_expires_at: 'invalid' },
    { setup_expires_at: '2020-01-01' }])
    assert.throws(() => requireAdultSetup({ ...person, ...change }, Date.parse('2026-01-01')))
})
test('setup cannot bypass origin checks or disabled recipient service', async () => {
  const url = 'https://vibeschool.example/api/success-wishes/receiver/verify'
  const old = process.env.SUCCESS_WISHES_RECEIVER_ENABLED
  delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED
  try {
    for (const handler of [POST, PATCH]) {
      for (const [origin, status] of [['https://evil.example', 403], ['https://vibeschool.example', 503]] as const) {
        const response = await handler(new NextRequest(url, { method: handler === POST ? 'POST' : 'PATCH',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ setupToken: 'a'.repeat(64), consentRole: 'adult', consentAcknowledged: true, code: '000000' }) }))
        assert.equal(response.status, status)
        assert.equal(Object.hasOwn(await response.json(), 'recoveryCode'), false)
      }
    }
  } finally {
    if (old === undefined) delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED
    else process.env.SUCCESS_WISHES_RECEIVER_ENABLED = old
  }
})
