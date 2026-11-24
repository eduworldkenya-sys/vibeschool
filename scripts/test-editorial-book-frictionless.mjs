import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const reader=read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const adapter=read('components/learn/PublishedTextbookLearnReader.tsx')
const studio=read('components/global/publish/PublicationEditor.tsx')
const css=read('components/learn/PublishedTextbookEditorial.module.css')
const server=read('app/read/textbook/[publicationId]/readerServer.ts')

test('clean editorial book styling is shared between Learn and Studio preview',()=>{
  assert.match(reader,/editorial\.premiumShell/)
  assert.match(reader,/editorial\.premiumPaper/)
  assert.match(studio,/editorial\.previewPaper/)
  assert.match(studio,/<PublishedTextbookLearnReader/)
  assert.match(reader,/<PublishedTextbookLearnReader/)
  assert.match(adapter,/PublishedTextbookEditorial\.module\.css/)
  assert.match(css,/\.premiumPaper/)
  assert.match(css,/\.media img/)
  assert.doesNotMatch(css,/gradient\(/)
})
test('main reading actions remain available without decorative chrome',()=>{
  assert.match(reader,/setContents\(true\)/)
  assert.match(reader,/setSheet\("tools"\)/)
  assert.match(reader,/go\(index\+1\)/)
  assert.match(reader,/go\(index-1\)/)
  assert.match(reader,/aria-label="Text size"/)
  assert.doesNotMatch(reader,/className=\{timeStyles\.subjectTag\}/)
  assert.match(css,/\.premiumTool:focus-visible/)
  assert.match(css,/@media\(max-width:700px\)/)
})
test('read, progress, public access and no offline downloading remain invariant',()=>{
  assert.match(server,/get_public_vibetextbook_reader/)
  assert.match(reader,/active\.can_read/)
  assert.doesNotMatch(reader,/record_reading_progress/, 'Reader progress is written by the canonical continuity coordinator')
  assert.match(reader,/ReaderLearningSheet/)
  assert.doesNotMatch(reader,/OfflineBookSaveButton|saveOfflineBook|offline\/books\//)
})
