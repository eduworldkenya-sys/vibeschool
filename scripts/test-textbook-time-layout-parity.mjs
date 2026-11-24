import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const time = read('components/learn/Grade4TimeContentReader.tsx')
const timeStyles = read('components/learn/Grade4TimeContentReader.module.css')
const reader = read('app/read/textbook/[publicationId]/ReaderClient.tsx')
const adapter = read('components/learn/PublishedTextbookLearnReader.tsx')
const paper = read('components/learn/PublishedTextbookPaper.module.css')

test('published Creative Arts and all school textbooks use Mathematics Time layout components',()=>{
  assert.match(time,/className=\{styles\.breadcrumbs\}/)
  assert.match(time,/className=\{styles\.hero\}/)
  assert.match(time,/className=\{styles\.lessonChooser\}/)
  assert.match(time,/className=\{styles\.article\}/)
  assert.match(time,/className=\{styles\.readerToolbar\}/)
  assert.match(reader,/Grade4TimeContentReader\.module\.css/)
  for (const key of ['breadcrumbs','hero','heroTitle','heroDescription','lessonChooser','lessonList','contentArea','article','articleHead','articleTitle','readerToolbar','textSettings','goal','lessonPager']) {
    assert.match(reader,new RegExp('timeStyles\\.'+key))
  }
  assert.match(timeStyles,/\.article\{background:white/)
})
test('Time-style reader preserves canonical textbook access, images and tools',()=>{
  assert.match(reader,/active\.can_read/)
  assert.match(reader,/PublishedTextbookLearnReader/)
  assert.match(adapter,/UniversalLearnReader/)
  assert.match(adapter,/block\.type === 'image'/)
  assert.match(adapter,/BiologyInteractiveBlock/)
  assert.doesNotMatch(reader,/record_reading_progress/, 'Reader progress is written by the canonical continuity coordinator')
  assert.match(reader,/ReaderLearningSheet/)
  assert.doesNotMatch(reader,/OfflineBookSaveButton/, 'Offline book download must remain absent')
  assert.match(reader,/ReaderNarrationMiniPlayer/)
  assert.match(reader,/router\.back\(\)/)
})
test('same grade and subject breadcrumbs, lessons and navigation; no hardcoded creative arts book',()=>{
  assert.match(reader,/href="\/learn"/)
  assert.match(reader,/active\?\.curriculum\?\.subject\|\|pub\.cbc_subject/)
  assert.match(reader,/chapters\.map\(\(chapter,i\)/)
  assert.match(reader,/go\(i\)/)
  assert.match(reader,/go\(index-1\)/)
  assert.match(reader,/go\(index\+1\)/)
  assert.doesNotMatch(reader,/eff38437-a033-4f62-83b4-59f2dfa0c889/)
})

test('textbooks use conventional square paper, quiet shadows and no nested AI-like section cards',()=>{
  assert.match(reader,/paperStyles\.squareArticle/)
  assert.match(reader,/paperStyles\.plainReader/)
  assert.match(paper,/border-radius: 3px/)
  assert.match(paper,/box-shadow: 0 3px 12px/)
  assert.match(paper,/section\[data-tone\]/)
  assert.match(paper,/border-radius: 0/)
  assert.match(paper,/box-shadow: none/)
  assert.doesNotMatch(paper,/gradient\(/)
})
