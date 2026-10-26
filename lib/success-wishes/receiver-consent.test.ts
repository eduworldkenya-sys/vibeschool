import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredConsentRoute, registeredWithdrawalRoute, verifyConsentDeclaration } from './receiver-consent'

const base = { phone_e164: '+254712345678', guardian_phone_e164: null as string | null,
  consent_route: null as 'adult' | 'guardian' | null, consent_status: 'pending' }

test('pending adult uses only trusted stored receiver phone and purpose-bound challenge', () => {
  assert.deepEqual(registeredConsentRoute({ ...base, consent_route: 'adult' }),
    { phone: base.phone_e164, purpose: 'consent_adult', consentRole: 'adult' })
  assert.doesNotThrow(() => verifyConsentDeclaration('adult','adult',true))
  assert.throws(() => verifyConsentDeclaration('adult','guardian',true))
  assert.throws(() => verifyConsentDeclaration('adult','adult',false))
})
test('pending minor requires a pre-provisioned guardian phone and affirmative guardian consent', () => {
  assert.throws(() => registeredConsentRoute({ ...base, consent_route: 'guardian' }), /guardian/)
  const guardian = registeredConsentRoute({ ...base, consent_route: 'guardian', guardian_phone_e164: '+254733222111' })
  assert.deepEqual(guardian,
    { phone: '+254733222111', purpose: 'consent_guardian', consentRole: 'guardian' })
  assert.throws(() => verifyConsentDeclaration('guardian','guardian',undefined))
  assert.throws(() => verifyConsentDeclaration('guardian','adult',true))
  assert.doesNotThrow(() => verifyConsentDeclaration('guardian','guardian',true))
})
test('cannot bootstrap unassigned identity, revoked recipient, or select recipient by shared phone', () => {
  assert.throws(() => registeredConsentRoute(base), /configured/)
  assert.throws(() => registeredConsentRoute({ ...base,consent_status:'revoked',consent_route:'adult' }))
  assert.deepEqual(registeredConsentRoute({ ...base,consent_status:'verified' }),
    { phone: base.phone_e164, purpose: 'recovery', consentRole: 'verified' })
  assert.doesNotThrow(() => verifyConsentDeclaration('verified','verified',undefined))
})

test('withdrawal always uses pre-registered adult or guardian authority, never the requester phone', () => {
  assert.deepEqual(registeredWithdrawalRoute({ ...base, consent_status: 'verified', consent_route: 'adult' }),
    { phone: base.phone_e164, purpose: 'consent_adult', consentRole: 'adult' })
  assert.deepEqual(registeredWithdrawalRoute({ ...base, consent_status: 'verified',
    consent_route: 'guardian', guardian_phone_e164: '+254733222111' }),
    { phone: '+254733222111', purpose: 'consent_guardian', consentRole: 'guardian' })
  assert.throws(() => registeredWithdrawalRoute({ ...base, consent_status: 'verified',
    consent_route: 'guardian' }), /support/)
  assert.throws(() => registeredWithdrawalRoute({ ...base, consent_route: 'adult' }), /verified/)
  assert.throws(() => registeredWithdrawalRoute({ ...base, consent_status: 'revoked',
    consent_route: 'guardian', guardian_phone_e164: '+254733222111' }), /verified/)
})
