import test from 'node:test'
import assert from 'node:assert/strict'
import { createSuccessWishesMediaAdapter, successWishesMediaReady } from './media'

const uid = 'a'.repeat(32)
const env = { SUCCESS_WISHES_CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), SUCCESS_WISHES_CLOUDFLARE_API_TOKEN: 'test-secret' }
const messageId = '00000000-0000-4000-8000-000000000001'
const now = () => Date.parse('2026-10-20T14:00:00Z')
const ok = (result: unknown) => Response.json({success: true, result})

test('unconfigured hosting fails closed without issuing a request', async () => {
  assert.equal(successWishesMediaReady({}), false)
  const adapter = createSuccessWishesMediaAdapter({env: {}, fetch: async () => {throw new Error('must not call')}})
  await assert.rejects(adapter.createDirectUpload(messageId), /not configured/)
})

test('direct uploads enforce privacy, duration, expiry and retention', async () => {
  let called = false
  const adapter = createSuccessWishesMediaAdapter({env, now, fetch: async (url, init) => {
    called = true
    assert.match(String(url), /\/stream\/direct_upload$/)
    assert.equal(init?.method, 'POST')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.requireSignedURLs, true)
    assert.equal(body.maxDurationSeconds, 60)
    assert.equal(body.expiry, '2026-10-20T14:15:00.000Z')
    assert.equal(body.scheduledDeletion, '2026-12-19T14:00:00.000Z')
    assert.deepEqual(body.meta, {messageId})
    return ok({uid, uploadURL: 'https://upload.videodelivery.net/test-token'})
  }})
  assert.equal((await adapter.createDirectUpload(messageId)).uid, uid)
  assert.equal(called, true)
})

test('provider failures, malformed identifiers and foreign upload hosts are rejected', async () => {
  const fixtures = [
    Response.json({success: false, result: {uid}}),
    ok({uid: '../escape', uploadURL: 'https://upload.videodelivery.net/test'}),
    ok({uid, uploadURL: 'https://attacker.example/upload'}),
    new Response('error', {status: 502}),
  ]
  for (const response of fixtures) {
    const adapter = createSuccessWishesMediaAdapter({env, fetch: async () => response})
    await assert.rejects(adapter.createDirectUpload(messageId))
  }
})

test('playback verifies provider privacy and refuses processing or oversized videos', async () => {
  for (const fixture of [
    {uid, requireSignedURLs: false, status: {state: 'ready'}, readyToStream: true, duration: 30},
    {uid, requireSignedURLs: true, status: {state: 'inprogress'}, readyToStream: false},
    {uid, requireSignedURLs: true, status: {state: 'ready'}, readyToStream: true, duration: 61},
    {uid: 'c'.repeat(32), requireSignedURLs: true, status: {state: 'ready'}, readyToStream: true, duration: 30},
  ]) {
    let requests = 0
    const adapter = createSuccessWishesMediaAdapter({env, fetch: async () => {requests++; return ok(fixture)}})
    await assert.rejects(adapter.createPlayback(uid))
    assert.equal(requests, 1)
  }
})

test('playback token expires in five minutes and does not permit downloads', async () => {
  const adapter = createSuccessWishesMediaAdapter({env, now, fetch: async (url, init) => {
    if (String(url).endsWith('/token')) {
      assert.deepEqual(JSON.parse(String(init?.body)), {exp: Math.floor(now() / 1000) + 300, downloadable: false})
      return ok({token: 'header.payload.signature'})
    }
    return ok({uid, requireSignedURLs: true, readyToStream: true, duration: 30, status: {state: 'ready'}})
  }})
  const playback = await adapter.createPlayback(uid)
  assert.equal(playback.url, 'https://iframe.videodelivery.net/header.payload.signature')
  assert.equal(playback.expiresAt, '2026-10-20T14:05:00.000Z')
})

test('delete checks status and never treats a failed provider request as deletion', async () => {
  const adapter = createSuccessWishesMediaAdapter({env, fetch: async (_url, init) => {
    assert.equal(init?.method, 'DELETE')
    return new Response(null, {status: 204})
  }})
  await adapter.deleteVideo(uid)
  const failed = createSuccessWishesMediaAdapter({env, fetch: async () => new Response(null, {status: 503})})
  await assert.rejects(failed.deleteVideo(uid), /503/)
  await assert.rejects(adapter.deleteVideo('../escape'), /identifier/)
})
