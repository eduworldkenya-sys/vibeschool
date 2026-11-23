import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const published = read('components/learn/PublishedTextbookLearnReader.tsx')
const studio = read('components/global/publish/PublicationEditor.tsx')
const styles = read('components/learn/PublishedTextbookEditorial.module.css')
const publicServer = read('app/read/textbook/[publicationId]/readerServer.ts')
const reader = read('app/read/textbook/[publicationId]/ReaderClient.tsx')

test('authoring preview and released reader share one editorial renderer', () => {
  assert.match(studio, /import PublishedTextbookLearnReader/)
  assert.match(studio, /previewMode && format === 'vibetextbook'/)
  assert.match(studio, /<PublishedTextbookLearnReader subject=\{publication\.cbc_subject/)
  assert.match(reader, /<PublishedTextbookLearnReader subject=/)
  assert.match(published, /presentation="book"/)
  assert.match(published, /PublishedTextbookEditorial\.module\.css/)
})
test('textbook activities and examples are editorial sections, not generic shaded cards', () => {
  assert.match(published, /className=\{styles\.activity\}/)
  assert.match(published, /styles\.example/)
  assert.match(published, /styles\.keyIdea/)
  assert.doesNotMatch(published, /background: '#fff', borderRadius: 2/)
  assert.match(styles, /\.activity\s*\{/)
  assert.doesNotMatch(styles, /gradient\(/)
})
test('published access and reading progress remain on existing authority', () => {
  assert.match(publicServer, /get_public_vibetextbook_reader/)
  assert.match(reader, /active\.can_read/)
  assert.match(reader, /record_reading_progress/)
  assert.match(studio, /publishPublication\(/)
  assert.doesNotMatch(published, /dangerouslySetInnerHTML/)
})
