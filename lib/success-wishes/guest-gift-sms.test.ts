import test from 'node:test'
import assert from 'node:assert/strict'
import { giftSmsReady, sendGiftSms } from './guest-gift-sms'

const env = {
  SUCCESS_WISHES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'controlled-test-service-role',
  SUCCESS_WISHES_GIFT_SMS_ENABLED:'true',
  SUCCESS_WISHES_AT_MODE:'sandbox', VERCEL_ENV:'preview',
  SUCCESS_WISHES_AT_USERNAME:'sandbox',SUCCESS_WISHES_AT_API_KEY:'synthetic',
}
const link='https://vibeschool.co.ke/success-wishes/gift#token='+'a'.repeat(64)
test('delivery switch defaults off and sandbox cannot send from production',()=>{
  assert.equal(giftSmsReady({}),false)
  assert.equal(giftSmsReady({...env,SUCCESS_WISHES_GIFT_SMS_ENABLED:'false'}),false)
  assert.equal(giftSmsReady({...env,VERCEL_ENV:'production'}),false)
  assert.equal(giftSmsReady({...env,SUCCESS_WISHES_AT_MODE:'live',VERCEL_ENV:'production'}),true)
})
test('guest gift SMS goes to parent number, never the payer, and checks provider acceptance',async()=>{
 const original=globalThis.fetch
 let count=0
 try{
  globalThis.fetch=(async (_url,options)=>{
   count++
   const p=new URLSearchParams(String(options?.body))
   assert.equal(p.get('to'),'+254733000111')
   assert.ok(p.get('message')?.includes(link))
   assert.equal(p.get('message')?.includes('Synthetic sender'),false)
   return Response.json({SMSMessageData:{Recipients:[{number:'+254733000111',statusCode:102,status:'Success',messageId:'QA-SMS'}]}})
  }) as typeof fetch
  assert.deepEqual(await sendGiftSms('0733000111',link,env),{providerId:'QA-SMS'})
  assert.equal(count,1)
  await assert.rejects(sendGiftSms('0733000111','https://example.com/evil',env),/Invalid private delivery link/)
  assert.equal(count,1)
  globalThis.fetch=(async ()=>Response.json({SMSMessageData:{Recipients:[{number:'+254712000111',statusCode:102,status:'Success'}]}})) as typeof fetch
  await assert.rejects(sendGiftSms('0733000111',link,env),/not confirmed/)
 }finally{globalThis.fetch=original}
})
