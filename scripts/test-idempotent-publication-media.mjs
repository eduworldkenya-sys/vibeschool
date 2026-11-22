import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const media = readFileSync(new URL('../lib/vibepressMedia.ts', import.meta.url), 'utf8')
const draft = readFileSync(new URL('../hooks/usePublicationDraft.ts', import.meta.url), 'utf8')

test('retry of already-promoted media must verify identical bytes and never overwrite', () => {
  assert.match(media, /upsert: false/)
  assert.match(media, /status !== 409/)
  assert.match(media, /resource already exists/)
  assert.match(media, /\.download\(publicPath\)/)
  assert.match(media, /identicalBlobs\(blob, existing\)/)
  assert.match(media, /first\.size !== second\.size/)
  assert.match(media, /left\[i\] !== right\[i\]/)
  assert.match(media, /refusing to overwrite or reuse it/)
  assert.match(media, /createdByThisAttempt = false/)
})
test('rollback only deletes newly created objects and preserves pre-existing storage assets', () => {
  assert.match(media, /promoted\.filter\(item => item\.createdByThisAttempt\)/)
  assert.match(media, /finalizePromotedMedia/)
  assert.match(media, /promoted\.map\(item => item\.draftPath\)/)
  assert.match(draft, /replacements\.set\(image\.sourceRef, image\.publicUrl\)/)
  assert.match(draft, /rollbackPromotedMedia\(sb, promoted\)/)
  assert.match(draft, /publishPublicationLifecycle\(sb, preparedPub\.id\)/)
})
