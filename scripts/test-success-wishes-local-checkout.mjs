// End-to-end LOCAL STORE contract: no Safaricom, Supabase or real grants.
// Run with: node --test scripts/test-success-wishes-local-checkout.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = {
  candidate: 'Sample student', sender: 'Sample sender',
  message: 'All the best in your exams.', examYear: '2026',
  school: 'Gilgil Township', theme: 'heritage', phoneLast4: '4149',
}

test('localhost simulated checkout refuses premature access and grants exactly one test invitation after success', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'vsw-checkout-test-'))
  const previous = process.cwd()
  try {
    const source = await readFile(path.join(repoRoot, 'lib/success-wishes/local-test-store.ts'), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } })
    const compiledFile = path.join(temp, 'store.cjs')
    await writeFile(compiledFile, compiled.outputText)
    process.chdir(temp)
    const store = createRequire(import.meta.url)(compiledFile)

    const failed = await store.startLocalTestCheckout(input)
    assert.equal(failed.amountKes, 50)
    assert.equal(failed.state, 'awaiting_test_result')
    assert.equal((await store.readLocalTestCheckout(failed.orderId, failed.key)).realAccess, false)
    assert.equal(await store.readLocalTestCheckout(failed.orderId, 'wrong-key'), null)
    assert.equal(await store.resolveLocalTestCheckout(failed.orderId, 'wrong-key', 'success'), null)
    assert.equal((await store.resolveLocalTestCheckout(failed.orderId, failed.key, 'failure')).invitationToken, null)
    assert.equal((await store.readLocalTestCheckout(failed.orderId, failed.key)).state, 'failed_simulated')
    assert.equal((await store.resolveLocalTestCheckout(failed.orderId, failed.key, 'success')).conflict, true)

    const paid = await store.startLocalTestCheckout(input)
    const [first, duplicate] = await Promise.all([
      store.resolveLocalTestCheckout(paid.orderId, paid.key, 'success'),
      store.resolveLocalTestCheckout(paid.orderId, paid.key, 'success'),
    ])
    assert.equal(first.state, 'settled_simulated')
    assert.equal(first.realAccess, false)
    assert.match(first.invitationToken, /^[a-zA-Z0-9_-]{40,60}$/)
    assert.equal(duplicate.conflict, true)
    assert.equal((await store.readLocalTestCheckout(paid.orderId, paid.key)).state, 'settled_simulated')
    const claimed = await store.claimLocalTestWish(first.invitationToken)
    assert.equal(claimed.wish.candidate, input.candidate)
    assert.equal(claimed.wish.message, input.message)
    assert.equal(claimed.wish.priceKes, 50)

    const file = JSON.parse(await readFile(path.join(temp, '.success-wishes-test-data.json'), 'utf8'))
    assert.equal(file.wishes.length, 1, 'a simulated success mints exactly one local test invitation')
    assert.equal(file.checkouts.length, 2, 'each attempt has its own immutable test outcome')
    assert.equal(file.checkouts[0].state, 'failed_simulated')
    assert.equal(file.checkouts[1].state, 'settled_simulated')
    assert.equal(file.wishes[0].invitationHash.length, 64)
    assert.equal(JSON.stringify(file).includes(first.invitationToken), false, 'do not store private link token in plaintext')
  } finally {
    process.chdir(previous)
    await rm(temp, { recursive: true, force: true })
  }
})

test('production cannot call simulated checkout from browser', async () => {
  const route = await readFile(path.join(repoRoot, 'app/api/success-wishes/test-checkout/route.ts'), 'utf8')
  const guard = await readFile(path.join(repoRoot, 'lib/success-wishes/local-test-guard.ts'), 'utf8')
  const component = await readFile(path.join(repoRoot, 'components/success-wishes/SuccessCardStudio.tsx'), 'utf8')
  assert.match(route, /localTestGuard\(request\)/)
  assert.match(guard, /process\.env\.NODE_ENV !== 'development'/)
  assert.match(guard, /VIBESCHOOL_SUCCESS_WISHES_TEST_MODE !== '1'/)
  assert.match(guard, /\['localhost', '127\.0\.0\.1', '::1'\]/)
  assert.match(route, /data\.version !== 'text'/)
  assert.match(route, /data\.amount_kes !== undefined/)
  assert.match(component, /LOCAL SIMULATION · NO M-PESA CHARGE/)
  assert.match(component, /testMode=\{testMode\}/)
  assert.doesNotMatch(component, /Complete test order · KES 50/)
})
