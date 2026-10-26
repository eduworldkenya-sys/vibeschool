import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, POST } from '../../app/api/success-wishes/receiver/guardian-consent/route'

const url='https://vibeschool.example/api/success-wishes/receiver/guardian-consent'
test('disabled receiver never exposes guardian directory or processes withdrawal',async()=>{
 const oldEnabled=process.env.SUCCESS_WISHES_ENABLED
 const oldReceiver=process.env.SUCCESS_WISHES_RECEIVER_ENABLED
 try {
   process.env.SUCCESS_WISHES_ENABLED='false'
   process.env.SUCCESS_WISHES_RECEIVER_ENABLED='false'
   const get=await GET(new NextRequest(url))
   assert.equal(get.status,503)
   assert.equal(Object.hasOwn(await get.json(),'recipients'),false)
   const post=await POST(new NextRequest(url,{
     method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},
     body:JSON.stringify({action:'confirm',receiverId:'44444444-4444-4444-8444-444444444444',
       challengeId:'55555555-5555-4555-8555-555555555555',code:'123456'}),
   }))
   assert.equal(post.status,503)
   assert.equal(Object.hasOwn(await post.json(),'revoked'),false)
 } finally {
   if(oldEnabled===undefined)delete process.env.SUCCESS_WISHES_ENABLED
   else process.env.SUCCESS_WISHES_ENABLED=oldEnabled
   if(oldReceiver===undefined)delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED
   else process.env.SUCCESS_WISHES_RECEIVER_ENABLED=oldReceiver
 }
})
test('cross-origin withdrawal requests are rejected before accessing guardian records',async()=>{
 const result=await POST(new NextRequest(url,{
   method:'POST',headers:{origin:'https://malicious.example','content-type':'application/json'},
   body:JSON.stringify({action:'confirm',receiverId:'44444444-4444-4444-8444-444444444444',
     challengeId:'55555555-5555-4555-8555-555555555555',code:'123456'}),
 }))
 assert.equal(result.status,403)
})
