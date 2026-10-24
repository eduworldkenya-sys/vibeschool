// Tests the operator-only Daraja adapter with injected fake HTTP responses.
// NO REAL PROVIDER TRAFFIC, STK PUSH OR SUPABASE ACCESS is possible here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const goodOrderId = '123e4567-e89b-42d3-a456-426614174000'
const secondOrderId = '123e4567-e89b-42d3-a456-426614174001'
const checkoutId = 'ws_CO_231020261459058708374149'

async function withCompiled(pathName, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsw-hosted-test-'))
  const cwd = process.cwd()
  try {
    const source = await readFile(path.join(root, pathName), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    } }).outputText
    const compiledPath = path.join(dir, 'module.cjs')
    await writeFile(compiledPath, compiled)
    process.chdir(dir)
    await run(createRequire(import.meta.url)(compiledPath), dir)
  } finally { process.chdir(cwd); await rm(dir, { recursive: true, force: true }) }
}

test('hosted sandbox requires localhost dev flag, sandbox provider and private token', async () => {
  await withCompiled('lib/success-wishes/hosted-daraja-test.ts', async lib => {
    const valid = {
      NODE_ENV: 'development', MPESA_ENV: 'sandbox',
      VIBESCHOOL_SUCCESS_WISHES_TEST_MODE: '1',
      VIBESCHOOL_DARAJA_HOSTED_TEST_ENABLED: '1',
      COMMERCE_SANDBOX_OPERATOR_TOKEN: 'A'.repeat(48),
      COMMERCE_SANDBOX_TEST_PHONE: '254708374149',
      COMMERCE_SANDBOX_PROJECT_REF: 'ufqjgyzspavamdpkdxmc',
    }
    assert.ok(lib.hostedSandboxConfig(valid))
    for (const veto of [
      { NODE_ENV: 'production' }, { VERCEL_ENV: 'preview' },
      { VERCEL_ENV: 'production' }, { MPESA_ENV: 'production' },
      { COMMERCE_SANDBOX_PROJECT_REF: 'yauqsxggtuxuykcbrtzf' },
      { COMMERCE_SANDBOX_TEST_PHONE: '254700000000' },
      { VIBESCHOOL_DARAJA_HOSTED_TEST_ENABLED: '0' },
      { VIBESCHOOL_SUCCESS_WISHES_TEST_MODE: '0' },
      { COMMERCE_SANDBOX_OPERATOR_TOKEN: 'weak' },
      { NEXT_PUBLIC_COMMERCE_SANDBOX_OPERATOR_TOKEN: 'accidental-exposure' },
    ]) assert.equal(lib.hostedSandboxConfig({ ...valid, ...veto }), null,
      'unsafe or missing sandbox boundary should disable hosted checkout')
  })
})

test('one STK POST uses pinned test product/phone and no browser secrets', async () => {
  await withCompiled('lib/success-wishes/hosted-daraja-test.ts', async lib => {
    let calls = 0
    const token = 'F'.repeat(48)
    const mock = async (url, opts) => {
      calls++
      assert.equal(url, lib.SANDBOX_ORIGIN + '/unified-commerce-sandbox-checkout')
      assert.equal(opts.headers.Authorization, 'Bearer ' + token)
      const body = JSON.parse(opts.body)
      assert.deepEqual(Object.keys(body).sort(),
        ['idempotency_key','item_reference','owner_reference','owner_type','phone','product_kind'].sort())
      assert.equal(body.item_reference, 'sandbox-success-wish')
      assert.equal(body.phone, '254708374149')
      assert.equal(body.owner_type, 'guest')
      assert.equal(body.idempotency_key, 'browser_test_' + goodOrderId.replaceAll('-', ''))
      assert.equal(opts.redirect, 'error')
      return new Response(JSON.stringify({
        mode: 'sandbox', order_id: goodOrderId,
        checkout_request_id: checkoutId, amount_kes: 50,
        state: 'awaiting_customer',
      }), { status: 202 })
    }
    const output = await lib.initiateHostedSandboxStk({
      localOrderId: goodOrderId, phone: '254708374149',
      guestReference: 'guest_browser_' + goodOrderId.replaceAll('-', ''),
    }, { token }, mock)
    assert.equal(calls, 1)
    assert.equal(output.state, 'awaiting_customer')
    assert.equal(output.realAccess, false)
    await assert.rejects(lib.initiateHostedSandboxStk({
      localOrderId: goodOrderId, phone: '254712345678',
      guestReference: 'guest_test_123',
    }, { token }, mock), /Unsupported/)
    assert.equal(calls, 1)
  })
})

test('status queries never re-initiate checkout; reject forged or contradictory states', async () => {
  await withCompiled('lib/success-wishes/hosted-daraja-test.ts', async lib => {
    const request = async (result) => {
      const mock = async (url, opts) => {
        assert.equal(url, lib.SANDBOX_ORIGIN + '/unified-commerce-sandbox-status')
        assert.deepEqual(JSON.parse(opts.body), { order_id: goodOrderId })
        return new Response(JSON.stringify(result), { status: 200 })
      }
      return lib.queryHostedSandboxStk(goodOrderId, {token: 'K'.repeat(48)}, mock)
    }
    const paid = await request({ mode: 'sandbox', order_id: goodOrderId,
      state: 'settled_simulated', simulated_access: true, real_access: false })
    assert.equal(lib.classifyHostedSandboxStatus(paid), 'success')
    const expired = await request({ mode: 'sandbox', order_id: goodOrderId,
      state: 'created', processing_verdict: 'expired', provider_result_code: 1037,
      simulated_access: false, real_access: false })
    assert.equal(lib.classifyHostedSandboxStatus(expired), 'expired')
    await assert.rejects(request({ mode: 'sandbox', order_id: secondOrderId,
      state: 'settled_simulated', simulated_access: true, real_access: false }), /Mismatched/)
    await assert.rejects(request({ mode: 'sandbox', order_id: goodOrderId,
      state: 'settled_simulated', simulated_access: true, real_access: true }), /Mismatched/)
    await assert.rejects(request({ mode: 'sandbox', order_id: goodOrderId,
      state: 'settled_simulated', simulated_access: false, real_access: false }), /lacks/)
  })
})

test('hosted payment cannot use manual success; cannot resend STK; mints exactly one local test invitation', async () => {
  await withCompiled('lib/success-wishes/local-test-store.ts', async (store,dir) => {
    const input = { candidate: 'Test candidate', sender: 'Test sender',
      message: 'All the best', examYear: '2026', school: 'Gilgil Township',
      theme: 'heritage', phoneLast4: '4149' }
    const order = await store.startLocalTestCheckout(input, 'daraja')
    assert.equal((await store.resolveLocalTestCheckout(order.orderId, order.key, 'success')).conflict, true)
    assert.deepEqual(await Promise.all([
      store.claimHostedSandboxSend(order.orderId, order.key),
      store.claimHostedSandboxSend(order.orderId, order.key)
    ]), [true, false])
    assert.equal(await store.attachHostedSandboxOrder(order.orderId, order.key,goodOrderId,checkoutId), true)
    assert.equal((await store.applyHostedSandboxVerdict(
      order.orderId,order.key,goodOrderId,'pending')).realAccess, false)
    const [paid,duplicate] = await Promise.all([
      store.applyHostedSandboxVerdict(order.orderId,order.key,goodOrderId,'success'),
      store.applyHostedSandboxVerdict(order.orderId,order.key,goodOrderId,'success')
    ])
    assert.equal(paid.state, 'settled_simulated')
    assert.match(paid.invitationToken,/^[a-zA-Z0-9_-]{40,60}$/)
    assert.equal(duplicate.conflict, true)
    assert.equal((await store.claimLocalTestWish(paid.invitationToken)).wish.candidate, input.candidate)
    const output = JSON.parse(await readFile(path.join(dir,'.success-wishes-test-data.json'),'utf8'))
    assert.equal(output.wishes.length, 1)
    assert.equal(output.checkouts.length, 1)
    assert.equal(output.checkouts[0].hostedOrderId, goodOrderId)
    assert.equal(output.checkouts[0].state, 'settled_simulated')
    assert.equal(JSON.stringify(output).includes(paid.invitationToken), false)

    const abandoned = await store.startLocalTestCheckout(input,'daraja')
    assert.equal(await store.claimHostedSandboxSend(abandoned.orderId,abandoned.key),true)
    assert.equal(await store.markHostedSandboxUncertain(abandoned.orderId,abandoned.key),true)
    assert.equal(await store.claimHostedSandboxSend(abandoned.orderId,abandoned.key),false)
    assert.equal((await store.readLocalTestCheckout(abandoned.orderId,abandoned.key)).hostedState,'outcome_unknown')

    const failed = await store.startLocalTestCheckout(input,'daraja')
    assert.equal(await store.claimHostedSandboxSend(failed.orderId,failed.key),true)
    assert.equal(await store.attachHostedSandboxOrder(failed.orderId,failed.key,secondOrderId,checkoutId),true)
    const outcome = await store.applyHostedSandboxVerdict(failed.orderId,failed.key,secondOrderId,'expired')
    assert.equal(outcome.invitationToken,null)
    assert.equal((await store.readLocalTestCheckout(failed.orderId,failed.key)).state,'failed_simulated')
    assert.equal((await store.applyHostedSandboxVerdict(failed.orderId,failed.key,secondOrderId,'success')).conflict,true)
  })
})

test('the operator token is never returned to the browser and the route has localhost-only guard', async () => {
  const route = await readFile(path.join(root, 'app/api/success-wishes/test-daraja/route.ts'),'utf8')
  const component = await readFile(path.join(root,'components/success-wishes/SuccessCardStudio.tsx'),'utf8')
  assert.match(route, /localTestGuard\(request\)/)
  assert.match(route, /hostedSandboxConfig\(process\.env\)/)
  assert.match(route, /claimHostedSandboxSend\(orderId, key\)/)
  assert.match(route, /markHostedSandboxUncertain\(orderId, key\)/)
  // Public checkout stays review-only. Only testMode on localhost mounts the sandbox checkout.
  assert.match(component, /No payment prompt has been sent and your wish has not been submitted/)
  assert.match(component, /checkoutOpen && \\(testMode && selectedVersion === 'text'/)
  assert.match(component, /function SandboxDarajaCheckout\\(/)
  assert.match(component, /Send one sandbox STK/)
  assert.match(component, /Check payment status/)
  assert.doesNotMatch(component, /COMMERCE_SANDBOX_OPERATOR_TOKEN/)
})

test('Success Wishes test-mode checkout uses explicit prepare, one STK send and status-only polling', async () => {
  const ui = await readFile(path.join(root, 'components/success-wishes/SuccessCardStudio.tsx'), 'utf8')
  assert.match(ui, /checkoutOpen && \(testMode && selectedVersion === 'text'/)
  assert.match(ui, /<CheckoutPreview theme=\{theme\}/,
    'Normal non-test checkout must remain available')
  assert.match(ui, /function SandboxDarajaCheckout\(/)
  assert.match(ui, /request\('prepare',/)
  assert.match(ui, /request\('start', order\)/)
  assert.match(ui, /request\('status', order\)/)
  assert.match(ui, /stage !== 'prepared'/,
    'Block repeated STK submissions after the first attempt')
  assert.match(ui, /setStage\('outcome_unknown'\); setBusy\(true\)/,
    'Network ambiguity must not enable an STK retry')
  assert.match(ui, /data\.state !== 'awaiting_customer'/)
  assert.match(ui, /data\.state === 'settled_simulated'|next === 'settled_simulated'/)
  assert.match(ui, /Local test wish ready/)
})
