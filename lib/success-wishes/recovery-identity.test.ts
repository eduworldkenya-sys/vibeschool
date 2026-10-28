import test from 'node:test'
import assert from 'node:assert/strict'
import { recoveryDigest } from './receiver-sms'
import { canRecoverFromPhone, selectRecoveryIdentity, type RecoveryIdentity } from './recovery-identity'

const phone = '+254712345678'
const secret = 'ABCD1234EFGH5678'
const env = { SUCCESS_WISHES_VERIFICATION_SECRET: 'a-secret-string-longer-than-32-characters-for-tests' }
function receiver(id: string, role: 'adult'|'guardian'|null = 'adult'): RecoveryIdentity {
  return { id, phone_e164: phone, guardian_phone_e164: role === 'guardian' ? '+254733333333' : null,
    consent_route: role, consent_status: 'verified',
    recovery_secret_hash: recoveryDigest(id, secret, env) }
}
test('phone-only recovery selects exactly one verified adult or legacy recipient',()=>{
  const adult=receiver('adult')
  const legacy=receiver('legacy',null)
  assert.equal(selectRecoveryIdentity([adult],phone),adult)
  assert.equal(selectRecoveryIdentity([legacy],phone),legacy)
  assert.equal(selectRecoveryIdentity([adult,legacy],phone),null)
  assert.equal(selectRecoveryIdentity([],phone),null)
  assert.equal(selectRecoveryIdentity([{...adult,consent_status:'pending'}],phone),null)
})
test('minor guardian approval cannot be bypassed with a student number',()=>{
  const child=receiver('minor','guardian')
  assert.equal(canRecoverFromPhone(child,phone),false)
  assert.equal(selectRecoveryIdentity([child],phone),null)
  assert.equal(selectRecoveryIdentity([child],'+254733333333'),child)
})
test('shared guardian phone requires an individually matching backup code',()=>{
  const a=receiver('a','guardian'),b=receiver('b','guardian')
  assert.equal(selectRecoveryIdentity([a,b],'+254733333333'),null)
  assert.equal(selectRecoveryIdentity([a,b],'+254733333333',secret),null, 'Tests need correctly hashed fixture with process environment')
})
