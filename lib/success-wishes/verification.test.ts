import test from 'node:test'
import assert from 'node:assert/strict'
import {
  senderEmail, senderVerificationReady, senderFingerprint, senderCode,
  senderChallengeHash, senderCodeMatches, sendSenderCode,
} from './verification'
const secret = 's'.repeat(48)
const enabledEnv = {
  SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED: 'true',
  SUCCESS_WISHES_VERIFICATION_SECRET: secret,
  SUCCESS_WISHES_RESEND_API_KEY: 'test-only-key',
  SUCCESS_WISHES_EMAIL_FROM: 'VibeSchool <verify@example.org>',
}

test('sender verification is disabled until all server-only dependencies exist', () => {
  assert.equal(senderVerificationReady({}), false)
  assert.equal(senderVerificationReady({...enabledEnv,SUCCESS_WISHES_RESEND_API_KEY: undefined}), false)
  assert.equal(senderVerificationReady({...enabledEnv,SUCCESS_WISHES_VERIFICATION_SECRET:'short'}), false)
  assert.equal(senderVerificationReady(enabledEnv), true)
})
test('normalized email creates a stable private digest with no stored email', () => {
  const a = senderFingerprint('  SENDER@Example.Org ',secret)
  assert.equal(a,senderFingerprint('sender@example.org',secret))
  assert.match(a,/^[a-f0-9]{64}$/)
  assert.notEqual(a,senderFingerprint('someone-else@example.org',secret))
  for(const invalid of ['not-an-email','user@example.org\nBcc:evil@example.org','bad..dots@example.org']) {
    assert.throws(() => senderEmail(invalid))
  }
})
test('six-digit codes are random-shaped and salted by sender identity', () => {
  const code = senderCode()
  assert.match(code,/^\d{6}$/)
  const a = senderFingerprint('a@example.org',secret)
  const b = senderFingerprint('b@example.org',secret)
  assert.equal(senderCodeMatches(senderChallengeHash(a,code,secret),senderChallengeHash(a,code,secret)),true)
  assert.equal(senderCodeMatches(senderChallengeHash(a,code,secret),senderChallengeHash(b,code,secret)),false)
})
test('verification provider receives a plain-text code and no candidate details',async()=>{
  let requests=0
  await sendSenderCode('GUEST@example.org','000042',{
    env:enabledEnv,fingerprint:senderFingerprint('guest@example.org',secret),
    fetcher:async (url,options)=>{
      requests++
      assert.equal(url,'https://api.resend.com/emails')
      assert.equal(options?.method,'POST')
      const body=JSON.parse(String(options?.body))
      assert.deepEqual(body.to,['guest@example.org'])
      assert.match(body.text,/000042/)
      assert.doesNotMatch(JSON.stringify(body),/candidate|admission|message/i)
      return Response.json({id:'test'})
    },
  })
  assert.equal(requests,1)
  await assert.rejects(sendSenderCode('guest@example.org','000042',{
    env:enabledEnv,fingerprint:senderFingerprint('guest@example.org',secret),
    fetcher:async()=>new Response('unavailable',{status:503}),
  }),/rejected/)
})
