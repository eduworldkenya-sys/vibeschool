import test from 'node:test'
import assert from 'node:assert/strict'
import { hashedPhoneRateKey, matchesDigest, newOtp, otpDigest,
  recoveryDigest, receiverSmsReady, sendReceiverSms } from './receiver-sms'

const preview = {
  SUCCESS_WISHES_ENABLED:'true',
  SUCCESS_WISHES_RECEIVER_ENABLED:'true',
  SUCCESS_WISHES_RECEIVER_SMS_ENABLED:'true',
  NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'controlled-test-no-production-access',
  SUCCESS_WISHES_AT_MODE:'sandbox',
  SUCCESS_WISHES_AT_USERNAME:'sandbox',
  SUCCESS_WISHES_AT_API_KEY:'controlled-test-key-only',
  SUCCESS_WISHES_VERIFICATION_SECRET:'unit-test-only-verification-pepper-'.repeat(2),
  VERCEL_ENV:'preview',
}
test('receiver SMS refuses default-off and production sandbox use',()=>{
  assert.equal(receiverSmsReady({}),false)
  assert.equal(receiverSmsReady({...preview,SUCCESS_WISHES_RECEIVER_SMS_ENABLED:'false'}),false)
  assert.equal(receiverSmsReady({...preview,VERCEL_ENV:'production'}),false)
  assert.equal(receiverSmsReady({...preview,SUCCESS_WISHES_VERIFICATION_SECRET:'short'}),false)
  assert.equal(receiverSmsReady(preview),true)
})
test('receiver OTP/recovery hashes are purpose-separated and recipient-specific',()=>{
  assert.match(newOtp(),/^\d{6}$/)
  const p='+254712345678'
  assert.equal(hashedPhoneRateKey(p),hashedPhoneRateKey('0712345678'))
  const one=otpDigest('candidate-a','123456',preview)
  const two=otpDigest('candidate-b','123456',preview)
  assert.notEqual(one,two)
  assert.notEqual(one,recoveryDigest('candidate-a','123456',preview))
  assert.equal(matchesDigest(one,one),true)
  assert.equal(matchesDigest(one,two),false)
  assert.equal(matchesDigest('oops',one),false)
})
test('controlled SMS provider: accepts exactly one matching response; rejects mismatch or failure',async()=>{
  const original=globalThis.fetch
  const submissions: string[]=[]
  try{
    globalThis.fetch=(async (_url, options)=>{
      const form=new URLSearchParams(String(options?.body))
      submissions.push(form.get('to')||'')
      assert.equal(form.get('to'),'+254712345678')
      assert.equal(form.get('username'),'sandbox')
      assert.match(form.get('message')||'',/123456/)
      return Response.json({SMSMessageData:{Recipients:[{number:'+254712345678',statusCode:102,status:'Success',messageId:'controlled-id'}]}})
    }) as typeof fetch
    const result=await sendReceiverSms('0712345678','Your controlled code is 123456.',preview)
    assert.deepEqual(result,{providerId:'controlled-id',status:'accepted'})
    assert.deepEqual(submissions,['+254712345678'])
    globalThis.fetch=(async()=>Response.json({SMSMessageData:{Recipients:[{number:'+254712345679',statusCode:102,status:'Success'}]}})) as typeof fetch
    await assert.rejects(sendReceiverSms('0712345678','Your controlled code is 123456.',preview),/did not accept/)
    globalThis.fetch=(async()=>new Response('unavailable',{status:503})) as typeof fetch
    await assert.rejects(sendReceiverSms('0712345678','Your controlled code is 123456.',preview),/rejected/)
  }finally{globalThis.fetch=original}
})
