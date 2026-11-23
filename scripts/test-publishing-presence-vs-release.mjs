import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const editor=readFileSync(new URL('../components/global/publish/PublicationEditor.tsx',import.meta.url),'utf8')
const publishing=readFileSync(new URL('../app/teacher/studio/publishing/page.tsx',import.meta.url),'utf8')
test('questions and teacher guide are not reading-book release blockers',()=>{
  assert.match(editor,/key: 'assessment', label: 'Questions \(optional\)', ok: true/)
  assert.match(editor,/No questions or Teacher’s Guide required/)
  assert.match(editor,/key: 'learn'.*ok: false/)
})
test('publishing screen reports saved materials without demanding new copies',()=>{
  assert.match(publishing,/\.from\("vibe_chapters"\)\.select\("id,publication_id,blocks"\)/)
  assert.match(publishing,/countOfType\(chapter.blocks, "image"\)/)
  assert.match(publishing,/countOfType\(chapter.blocks, "question"\)/)
  assert.match(publishing,/questions written/)
  assert.match(publishing,/optional for reading release/)
  assert.match(publishing,/Teacher’s Guide are optional/)
  assert.match(publishing,/setEvidenceError\(true\)/)
  assert.match(publishing,/Mumbi2 can request publication/)
})