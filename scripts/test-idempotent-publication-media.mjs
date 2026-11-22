import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the real TypeScript module, not a string-matching approximation.
const source = readFileSync(new URL('../lib/vibepressMedia.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { promoteDraftMedia, rollbackPromotedMedia, finalizePromotedMedia, makeDraftMediaRef, VIBEPRESS_DRAFT_BUCKET, VIBEPRESS_IMAGE_BUCKET } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const path = 'test-user/images/painting.png'
const ref = makeDraftMediaRef(path)
const image = bytes => new Blob([Uint8Array.from(bytes)], { type: 'image/png' })

function fixture({ existingBytes = null, uploadError = null, publicReadError = null } = {}) {
  const events = { downloads: [], uploads: [], removes: [] }
  const original = image([11, 22, 33, 44])
  let publicObject = existingBytes === null ? null : image(existingBytes)
  const client = {
    storage: {
      from(bucket) {
        return {
          async download(objectPath) {
            events.downloads.push([bucket, objectPath])
            if (bucket === VIBEPRESS_DRAFT_BUCKET) return { data: original, error: null }
            if (publicReadError) return { data: null, error: new Error(publicReadError) }
            return publicObject ? { data: publicObject, error: null } : { data: null, error: new Error('Missing public object') }
          },
          async upload(objectPath, blob, options) {
            events.uploads.push([bucket, objectPath, options])
            if (uploadError) return { error: uploadError }
            publicObject = blob
            return { error: null }
          },
          getPublicUrl(objectPath) {
            return { data: { publicUrl: 'https://example.test/storage/v1/object/public/' + bucket + '/' + objectPath } }
          },
          async remove(paths) {
            events.removes.push([bucket, ...paths])
            return { error: null }
          },
        }
      },
    },
  }
  return { client, events }
}

test('a duplicate public object is reused only when bytes match; rollback preserves the original', async () => {
  const { client, events } = fixture({
    existingBytes: [11, 22, 33, 44],
    uploadError: { statusCode: '409', message: 'The resource already exists' },
  })
  const result = await promoteDraftMedia(client, ref, VIBEPRESS_IMAGE_BUCKET)
  assert.equal(result.createdByThisAttempt, false)
  assert.equal(result.sourceRef, ref)
  assert.equal(result.publicPath, path)
  assert.equal(events.uploads[0][2].upsert, false)
  assert.deepEqual(events.downloads, [[VIBEPRESS_DRAFT_BUCKET, path], [VIBEPRESS_IMAGE_BUCKET, path]])
  await rollbackPromotedMedia(client, [result])
  assert.deepEqual(events.removes, [])
  await finalizePromotedMedia(client, [result])
  assert.deepEqual(events.removes, [[VIBEPRESS_DRAFT_BUCKET, path]])
})

test('a public object with different bytes must not be overwritten or reused', async () => {
  const { client, events } = fixture({
    existingBytes: [11, 22, 33, 55],
    uploadError: { statusCode: 409, message: 'Duplicate' },
  })
  await assert.rejects(promoteDraftMedia(client, ref, VIBEPRESS_IMAGE_BUCKET), /different content/)
  assert.deepEqual(events.removes, [])
  assert.equal(events.uploads[0][2].upsert, false)
})

test('an unreadable existing public image must remain a hard failure', async () => {
  const { client, events } = fixture({
    uploadError: { statusCode: '409', message: 'Already exists' },
    publicReadError: 'Forbidden',
  })
  await assert.rejects(promoteDraftMedia(client, ref, VIBEPRESS_IMAGE_BUCKET), /could not be verified/)
  assert.deepEqual(events.removes, [])
})

test('a permission error cannot be mistaken for a duplicate', async () => {
  const { client, events } = fixture({ uploadError: { statusCode: 403, message: 'Permission denied' } })
  await assert.rejects(promoteDraftMedia(client, ref, VIBEPRESS_IMAGE_BUCKET), error => error?.message === 'Permission denied')
  assert.equal(events.downloads.length, 1)
  assert.deepEqual(events.removes, [])
})

test('new objects may be rolled back without touching draft storage', async () => {
  const { client, events } = fixture()
  const result = await promoteDraftMedia(client, ref, VIBEPRESS_IMAGE_BUCKET)
  assert.equal(result.createdByThisAttempt, true)
  await rollbackPromotedMedia(client, [result])
  assert.deepEqual(events.removes, [[VIBEPRESS_IMAGE_BUCKET, path]])
})

test('non-draft URLs do not trigger storage promotion', async () => {
  const { client, events } = fixture()
  const result = await promoteDraftMedia(client, 'https://example.test/image.png', VIBEPRESS_IMAGE_BUCKET)
  assert.equal(result, null)
  assert.equal(events.uploads.length, 0)
})
