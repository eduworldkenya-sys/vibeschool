import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const editor = readFileSync(new URL('../components/global/publish/PublicationEditor.tsx', import.meta.url), 'utf8')
const publishing = readFileSync(new URL('../app/teacher/studio/publishing/page.tsx', import.meta.url), 'utf8')

test('each unfinished editor check has a direct, accessible action', () => {
  for (const key of ['title', 'curriculum', 'content', 'media', 'assessment', 'authority', 'learn']) {
    assert.match(editor, new RegExp("key: '"+key+"'"))
    assert.match(editor, new RegExp("key === '"+key+"'"))
  }
  assert.match(editor, /onClick=\{\(\) => openCheck\(check.key, check.ok\)\}/)
  assert.match(editor, /aria-label=\{check.action \+ ' for ' \+ check.label\}/)
  assert.match(editor, /setSetupOpen\(true\)/)
  assert.match(editor, /titleInputRef\.current\?\.focus\(\)/)
  assert.match(editor, /setActiveChapterId\(chapter.id\)/)
  assert.match(editor, /setJumpBlockId\(target.id\)/)
  assert.match(editor, /setInsertTarget\(type\)/)
  assert.match(editor, /'studio-block-' \+ block.id/)
  assert.match(editor, /'studio-insert-' \+ action.type/)
  assert.match(editor, /setPreviewMode\(true\)/)
  assert.match(editor, /\/teacher\/studio\/publishing#publishing-availability/)
  assert.match(publishing, /id="publishing-availability"/)
  assert.doesNotMatch(editor, /const documentChecks[\s\S]*?ok:\s*true, detail: 'Awaiting server verification'/)
})

test('blocker navigation uses signed-in Mumbi2 identity rather than owner activation', () => {
  assert.match(editor, /if \(!canPublish\)/)
  assert.match(editor, /publishDisabled=\{!canPublish\}/)
  assert.match(publishing, /Mumbi2 can request publication/)
  assert.match(publishing, /release verification still required/)
})
