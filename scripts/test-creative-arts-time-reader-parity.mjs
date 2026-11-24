import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const reader=read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const adapter=read('components/learn/PublishedTextbookLearnReader.tsx')
const shared=read('components/learn/UniversalLearnReader.tsx')
const time=read('components/learn/Grade4TimeContentReader.tsx')

test('Creative Arts published textbook inherits the Time page and topic hierarchy',()=>{
  assert.match(reader,/Grade4TimeContentReader\.module\.css/)
  assert.match(reader,/timeStyles\.lessonChooser/)
  assert.match(reader,/timeStyles\.articleTitle/)
  assert.match(reader,/const topicTitle=active\?\.curriculum\?\.sub_strand/)
  assert.match(reader,/<h1 className=\{timeStyles\.heroTitle\}>\{topicTitle\}<\/h1>/)
  assert.match(reader,/<PublishedTextbookLearnReader subject=/)
  assert.match(time,/timeStyles|styles\.heroTitle/)
})
test('textbook content begins with actual saved prose rather than a generated heading',()=>{
  assert.match(adapter,/id: 'opening', title: ''/)
  assert.match(shared,/presentation === 'book' && !section\.title/)
  assert.match(shared,/section\.title \|\| presentation !== 'book'/)
  assert.match(reader,/active\.can_read/)
  assert.doesNotMatch(reader,/record_reading_progress/, 'Reader progress is written by the canonical continuity coordinator')
})
