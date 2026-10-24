// HTTP-level contract against an actual localhost Next.js dev server.
// Isolated provider requests are intercepted with a fake test-only fetch.
// No secrets, Safaricom traffic, charges or production entitlements.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, openSync, closeSync } from 'node:fs'
import { unlink, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = 3098
const base = 'http://localhost:' + port
const pathStore = path.join(root,'.success-wishes-test-data.json')
const logPath = path.join(os.tmpdir(),'vsw-hosted-daraja-http-test.log')
const stub = path.join(root,'scripts/commerce/mock-hosted-daraja-http.cjs')

async function post(action, obj = {}) {
  const response = await fetch(base + '/api/success-wishes/test-daraja',{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:base},
    body:JSON.stringify({action,...obj}),
    cache:'no-store'
  })
  return {status:response.status,body:await response.json()}
}

test('Next.js localhost hosted checkout: prepare, send once, verify provider-status and release exactly one TEST wish', {timeout:180_000},async()=>{
  assert.equal(existsSync(pathStore),false,'Do not run on a machine with existing local test card data')
  const log = openSync(logPath,'w')
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port',String(port)],{
    cwd:root,
    env:{
      ...process.env,
      NODE_ENV:'development',
      NODE_OPTIONS:'--require '+stub,
      VSW_HOSTED_HTTP_MOCK:'yes',
      VIBESCHOOL_SUCCESS_WISHES_TEST_MODE:'1',
      VIBESCHOOL_DARAJA_HOSTED_TEST_ENABLED:'1',
      COMMERCE_SANDBOX_OPERATOR_TOKEN:'A'.repeat(48),
      COMMERCE_SANDBOX_PROJECT_REF:'ufqjgyzspavamdpkdxmc',
      COMMERCE_SANDBOX_TEST_PHONE:'254708374149',
      MPESA_ENV:'sandbox',
      VERCEL_ENV:'',
      NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',
      SUCCESS_WISHES_ENABLED:'false',
    },
    stdio:['ignore',log,log],
  })
  try {
    let ready=false
    for(let i=0;i<110;i++) {
      if(child.exitCode!==null)throw new Error('Next test server exited')
      try {
        const r=await fetch(base+'/api/success-wishes/test-daraja',{cache:'no-store'})
        if(r.ok){assert.equal((await r.json()).available,true);ready=true;break}
      } catch {}
      await new Promise(resolve=>setTimeout(resolve,1000))
    }
    if(!ready)throw new Error('Sandbox operator route was not ready')
    const wrongPhone=await post('prepare',{candidate:'John',sender:'Parent',message:'Best of luck',
      examYear:'2026',school:'Gilgil Township',theme:'heritage',version:'text',phone:'0712345678'})
    assert.equal(wrongPhone.status,400,'Reject phone other than the exact sandbox test phone')
    const prepared=await post('prepare',{candidate:'John',sender:'Parent',
      message:'Best of luck in your exams',examYear:'2026',school:'Gilgil Township',
      theme:'heritage',version:'text',phone:'254708374149'})
    assert.equal(prepared.status,201,JSON.stringify(prepared.body))
    assert.equal(prepared.body.mode,'daraja_sandbox')
    assert.equal(prepared.body.state,'prepared')
    const {orderId,key}=prepared.body
    assert.match(orderId,/^[0-9a-f-]{36}$/)
    assert.match(key,/^[a-zA-Z0-9_-]{40,60}$/)
    const denied=await post('status',{orderId,key:'wrong-key'})
    assert.equal(denied.status,404)
    const early=await post('status',{orderId,key})
    assert.equal(early.body.state,'prepared')
    assert.equal(early.body.realAccess,false)
    assert.equal(early.body.invitationToken,undefined)
    const started=await post('start',{orderId,key})
    assert.equal(started.status,202,JSON.stringify(started.body))
    assert.equal(started.body.state,'awaiting_customer')
    const duplicate=await post('start',{orderId,key})
    assert.equal(duplicate.status,409,'Never resend STK if acknowledged or uncertain')
    const checked=await post('status',{orderId,key})
    assert.equal(checked.status,200,JSON.stringify(checked.body))
    assert.equal(checked.body.state,'settled_simulated')
    assert.equal(checked.body.realAccess,false)
    assert.match(checked.body.invitationToken,/^[a-zA-Z0-9_-]{40,60}$/)
    const replay=await post('status',{orderId,key})
    assert.equal(replay.body.state,'settled_simulated')
    assert.equal(replay.body.invitationToken,undefined,'Do not mint an additional invitation')
    const opened=await fetch(base+'/api/success-wishes/test-access',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:base},
      body:JSON.stringify({token:checked.body.invitationToken})})
    assert.equal(opened.status,200)
    const wish=(await opened.json()).wish
    assert.equal(wish.message,'Best of luck in your exams')
    assert.equal(wish.priceKes,50)
    const saved=JSON.parse(await readFile(pathStore,'utf8'))
    assert.equal(saved.wishes.length,1)
    assert.equal(saved.checkouts.length,1)
    assert.equal(saved.checkouts[0].state,'settled_simulated')
    assert.equal(JSON.stringify(saved).includes(checked.body.invitationToken),false)
  } finally {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise(resolve=>child.once('exit',resolve)),
      new Promise(resolve=>setTimeout(resolve,3500))
    ])
    closeSync(log)
    if(existsSync(pathStore))await unlink(pathStore)
  }
})
