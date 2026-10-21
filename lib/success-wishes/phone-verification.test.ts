import test from 'node:test'
import assert from 'node:assert/strict'
import {senderPhone,phoneFingerprint,phoneVerificationReady,sendSenderPhoneCode} from './phone-verification'

const secret='secret'.repeat(10)
const active={
  SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED:'true',
  SUCCESS_WISHES_VERIFICATION_SECRET:secret,
  SUCCESS_WISHES_AT_USERNAME:'sandbox',
  SUCCESS_WISHES_AT_API_KEY:'example-fixture-only',
  SUCCESS_WISHES_AT_MODE:'sandbox',
  VERCEL_ENV:'preview',
}
test('phone normalization accepts Kenya mobile and rejects arbitrary international numbers',()=>{
  for(const s of ['0712345678','+254712345678','254712345678','07 1234 5678'])
    assert.equal(senderPhone(s),'+254712345678')
  assert.equal(senderPhone('0112345678'),'+254112345678')
  for(const bad of ['','070000','+256712345678','999999999999','+254712345678;evil','0700000000\nBcc:'])
    assert.throws(()=>senderPhone(bad))
})
test('phone HMAC is stable, private and separated from other identities',()=>{
  assert.equal(phoneFingerprint('0712345678',secret),phoneFingerprint('+254712345678',secret))
  assert.notEqual(phoneFingerprint('0712345678',secret),phoneFingerprint('0712345679',secret))
  assert.match(phoneFingerprint('0712345678',secret),/^[a-f0-9]{64}$/)
})
test('no silent SMS activation: requires separate preview/live provider keys and 32+ secret',()=>{
  assert.equal(phoneVerificationReady({}),false)
  assert.equal(phoneVerificationReady({...active,SUCCESS_WISHES_AT_API_KEY:''}),false)
  assert.equal(phoneVerificationReady({...active,VERCEL_ENV:'production'}),false)
  assert.equal(phoneVerificationReady({...active,SUCCESS_WISHES_VERIFICATION_SECRET:'short'}),false)
  assert.equal(phoneVerificationReady(active),true)
  assert.equal(phoneVerificationReady({...active,SUCCESS_WISHES_AT_MODE:'live',VERCEL_ENV:'production'}),true)
})
test('only one accepted SMS response counts as sent and message contains no learner identifiers',async()=>{
  let called=0
  await sendSenderPhoneCode('0712345678','123456',{
    env:active,fetcher:async(url,opts)=>{
      called++
      assert.equal(url,'https://api.sandbox.africastalking.com/version1/messaging')
      assert.equal(opts?.method,'POST')
      const form=new URLSearchParams(String(opts?.body))
      assert.equal(form.get('to'),'+254712345678')
      assert.equal(form.get('username'),'sandbox')
      assert.match(form.get('message')||'',/123456/)
      assert.doesNotMatch(String(opts?.body),/admission|candidate|school/i)
      return Response.json({SMSMessageData:{Recipients:[{number:'+254712345678',status:'Success',statusCode:102}]}})
    },
  })
  assert.equal(called,1)
  await assert.rejects(sendSenderPhoneCode('+254712345678','123456',{env:active,
    fetcher:async()=>Response.json({SMSMessageData:{Recipients:[{number:'+254712345678',status:'InvalidPhoneNumber',statusCode:406}]}}),
  }),/did not accept/)
  await assert.rejects(sendSenderPhoneCode('+254712345678','123456',{env:active,
    fetcher:async()=>new Response('unavailable',{status:503}),
  }),/rejected/)
})
