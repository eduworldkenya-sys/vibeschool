import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editor = readFileSync(new URL('../components/global/publish/PublicationEditor.tsx', import.meta.url), 'utf8')

test('present chapter images and questions are counted, not flagged as missing', () => {
  assert.match(editor, /const imageCount = chapters\.reduce/)
  assert.match(editor, /const questionCount = chapters\.reduce/)
  assert.match(editor, /block\.type === 'image'/)
  assert.match(editor, /block\.type === 'question'/)
  assert.match(editor, /imageCount > 0[\s\S]*?release verification separate/)
  assert.match(editor, /questionCount > 0[\s\S]*?answer approval separate/)
  assert.match(editor, /imageCount > 0 \? 'Review images' : 'Add image'/)
  assert.match(editor, /questionCount > 0 \? 'Review questions' : 'Add question'/)
  assert.match(editor, /const documentChecks = \[/)
})

test('draft material presence remains distinct from release authorization and Learn checks', () => {
  assert.match(editor, /key: 'media', label: 'Images included \(draft\)', ok: imageCount > 0/)
  assert.match(editor, /key: 'assessment', label: 'Questions written \(draft\)', ok: questionCount > 0/)
  assert.match(editor, /key: 'authority', label: 'Publishing authority', ok: false/)
  assert.match(editor, /key: 'learn', label: 'Learn visibility', ok: false/)
  assert.match(editor, /if \(simpleMode\) return/)
})
