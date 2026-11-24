import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const adapter=read('components/learn/PublishedTextbookLearnReader.tsx')
const reader=read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const publicReader=read('app/read/textbook/[publicationId]/readerServer.ts')
const oldRoute=read('app/global/read/publication/[id]/page.tsx')
const learn=read('components/learn/SchoolLearnLibrary.tsx')

test('all published textbooks, including Creative Arts, use shared Learn presentation',()=>{
  assert.match(reader,/import PublishedTextbookLearnReader from/)
  assert.match(reader,/<PublishedTextbookLearnReader subject=/)
  assert.doesNotMatch(reader,/<LearningLoopArticle/)
  assert.match(adapter,/import UniversalLearnReader/)
  assert.match(adapter,/<UniversalLearnReader/)
  assert.match(adapter,/subject=\{subject\}/)
  assert.match(adapter,/sourceBlocks: ContentBlock\[\]/)
  assert.match(adapter,/group\.body = group\.sourceBlocks\.map/)
  assert.match(reader,/bg:"#f7f9f8"/)
  assert.match(reader,/surface:"#ffffff"/)
})

test('existing title, paragraphs, headings and six images remain on Learn reader',()=>{
  assert.match(adapter,/block\.type === 'heading1' \|\| block\.type === 'heading2'/)
  assert.match(adapter,/block\.type === 'image' \|\| block\.type === 'diagram'/)
  assert.match(adapter,/<img src=\{src\} alt=\{alt\}/)
  assert.match(adapter,/meta\.caption/)
  assert.match(adapter,/BiologyInteractiveBlock block=\{block\}/)
  assert.match(adapter,/block\.type === 'table'/)
  assert.match(adapter,/block\.type === 'question'/)
  assert.match(adapter,/block\.id/)
  assert.match(adapter,/return <VisualRichText body=\{text\}/)
})

test('same canonical published reader keeps access checks and learner continuity',()=>{
  assert.match(publicReader,/get_public_vibetextbook_reader/)
  assert.match(reader,/active\.can_read/)
  assert.doesNotMatch(reader,/record_reading_progress/, 'Reader progress is written by the canonical continuity coordinator')
  assert.match(reader,/ReaderLearningSheet/)
  assert.match(reader,/ReaderNarrationMiniPlayer/)
  assert.doesNotMatch(reader,/OfflineBookSaveButton|saveOfflineBook|offline\/books/)
  assert.match(learn,/\/read\/textbook\//)
  assert.match(oldRoute,/pub\.format === 'vibetextbook'/)
  assert.match(oldRoute,/router\.replace\('\/read\/textbook\/'/)
})
