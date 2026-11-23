import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { emptyPublication } from '../lib/publishTypes.ts'
import { publicationDraftToInsert, UNTITLED_DRAFT_TITLE } from '../lib/publicationDraftCodec.ts'

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')

test('brand-new lesson and ebook drafts persist with a valid title', () => {
  for (const format of ['vibetextbook','ebook']) {
    const draft = emptyPublication('00000000-0000-4000-8000-000000000001', format)
    assert.equal(draft.title, null, 'editor starts untitled')
    assert.equal(publicationDraftToInsert(draft).title, UNTITLED_DRAFT_TITLE)
    assert.equal(publicationDraftToInsert({...draft,title:'  Real title  '}).title,'Real title')
    assert.equal(publicationDraftToInsert({...draft,title:'  '}).title, UNTITLED_DRAFT_TITLE)
    assert.equal(publicationDraftToInsert({...draft,status:'published'}).title,undefined,'published records must not receive an implicit title')
  }
})

test('new draft starts normally, but placeholder cannot pass title or publishing checks', () => {
  const hook=read('hooks/usePublicationDraft.ts')
  const editor=read('components/global/publish/PublicationEditor.tsx')
  const entry=read('app/teacher/studio/page.tsx')
  assert.match(entry,/fresh=\$\{id\}/)
  assert.match(hook,/publicationDraftToInsert\(fresh\)/)
  assert.match(hook,/originalPub\.title\.trim\(\) === UNTITLED_DRAFT_TITLE/)
  assert.match(editor,/publication\.title === UNTITLED_DRAFT_TITLE/)
  assert.match(editor,/const hasRealTitle = Boolean/)
  assert.match(editor,/const draftMaterialsPresent = hasRealTitle/)
  assert.match(editor,/if \(!publication \|\| !hasRealTitle\)/)
})

test('real PostgREST error detail is retained rather than hidden behind Load failed', () => {
  const hook=read('hooks/usePublicationDraft.ts')
  assert.match(hook,/typeof dbError\?\.message === 'string'/)
  assert.doesNotMatch(hook,/setError\(reason instanceof Error \? reason\.message : 'Load failed'\)/)
})
