import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const editor=readFileSync(new URL('../components/global/publish/PublicationEditor.tsx',import.meta.url),'utf8')
const publishing=readFileSync(new URL('../app/teacher/studio/publishing/page.tsx',import.meta.url),'utf8')
test('existing images and questions finish only the draft presence checks',()=>{
  assert.match(editor,/key: 'media', label: 'Images included \(draft\)', ok: imageCount > 0/)
  assert.match(editor,/key: 'assessment', label: 'Questions written \(draft\)', ok: questionCount > 0/)
  assert.match(editor,/[Rr]ights, answers, security and Learn visibility require separate server checks/)
  assert.match(editor,/key: 'authority'.*ok: Boolean\(canPublish\)/)
  assert.match(editor,/key: 'learn'.*ok: false/)
})
test('publishing screen loads saved chapter block counts for selected publication',()=>{
  assert.match(publishing,/\.from\("vibe_chapters"\)\.select\("id,publication_id,blocks"\)/)
  assert.match(publishing,/\.eq\("publication_id", publicationId\)/)
  assert.match(publishing,/countOfType\(chapter.blocks, "image"\)/)
  assert.match(publishing,/countOfType\(chapter.blocks, "question"\)/)
  assert.match(publishing,/images attached/)
  assert.match(publishing,/questions written/)
  assert.match(publishing,/release verification still required/)
  assert.match(publishing,/setEvidenceError\(true\)/)
  assert.match(publishing,/do not add duplicates/)
  assert.match(publishing,/Zero of seven release checks verified/)
  assert.match(publishing,/Mumbi2 can request publication/)
})
