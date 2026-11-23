import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const editor=readFileSync(new URL('../components/global/publish/PublicationEditor.tsx',import.meta.url),'utf8')
test('existing materials remain counted without requiring questions or images',()=>{
  assert.match(editor,/const imageCount = chapters\.reduce/)
  assert.match(editor,/const questionCount = chapters\.reduce/)
  assert.match(editor,/key: 'media', label: 'Images \(optional\)', ok: true/)
  assert.match(editor,/key: 'assessment', label: 'Questions \(optional\)', ok: true/)
  assert.match(editor,/no questions required to publish reading content/)
})
test('Mumbi2 identity, content and Learn checks remain independent',()=>{
  assert.match(editor,/key: 'authority', label: 'Publishing identity', ok: Boolean\(canPublish\)/)
  assert.match(editor,/key: 'learn', label: 'Learn visibility', ok: false/)
  assert.match(editor,/if \(!canPublish\)/)
})