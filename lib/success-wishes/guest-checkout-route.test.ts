import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../../app/api/success-wishes/checkout/route'
const url='https://vibeschool.example/api/success-wishes/checkout'
test('checkout rejects cross-origin payment requests before database/provider access',async()=>{
 const r=await POST(new NextRequest(url,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({action:'pay',key:'a'.repeat(64)})}));assert.equal(r.status,403)
})
test('disabled recipient service cannot start checkout or accept a fake receipt',async()=>{
 const old=process.env.SUCCESS_WISHES_RECEIVER_ENABLED
 try{delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED
 for(const action of ['create','pay','status']){const r=await POST(new NextRequest(url,{method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},body:JSON.stringify({action,key:'a'.repeat(64),paid:true,receipt:'FORGED'})}));assert.equal(r.status,503);assert.equal(Object.hasOwn(await r.json(),'order'),false)}
 }finally{if(old===undefined)delete process.env.SUCCESS_WISHES_RECEIVER_ENABLED;else process.env.SUCCESS_WISHES_RECEIVER_ENABLED=old}
})
