import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const editor=readFileSync(new URL('../components/global/publish/PublicationEditor.tsx',import.meta.url),'utf8')
const hook=readFileSync(new URL('../hooks/usePublicationDraft.ts',import.meta.url),'utf8')
test('teacher checklist confirms reading text, not questions or teacher guide',()=>{
  assert.match(editor,/const \[materialsConfirmed, setMaterialsConfirmed\] = useState\(false\)/)
  assert.match(editor,/Confirm existing lesson materials/)
  assert.match(editor,/type="checkbox" checked=\{materialsConfirmed\}/)
  assert.match(editor,/No questions or Teacher’s Guide required/)
  assert.match(editor,/key: 'assessment', label: 'Questions \(optional\)', ok: true/)
})
test('checkbox resets on edits and is needed before the release action',()=>{
  assert.match(editor,/useEffect\(\(\) => \{ setMaterialsConfirmed\(false\) \}, \[chapters, publication\?\.title, publication\?\.cbc_subject, publication\?\.cbc_grade\]\)/)
  assert.match(editor,/if \(simpleMode && !materialsConfirmed\)/)
  assert.match(editor,/disabled=\{publishing \|\| publishedReadOnly \|\| !canPublish \|\| \(simpleMode && !materialsConfirmed\)\}/)
  assert.match(editor,/confirmedReadingOnlyTextbook: materialsConfirmed/)
})
test('reading-book release uses already existing owned textbook RPC rather than reviewed general publication',()=>{
  assert.match(hook,/if \(readingOnly\) await publishTextbook\(sb, preparedPub\.id\)/)
  assert.match(hook,/else await publishPublicationLifecycle\(sb, preparedPub\.id\)/)
  assert.match(hook,/isMumbi2Publisher\(authData\.user\.id, profile\?\.role\)/)
  assert.match(hook,/authData\.user\.id !== originalPub\.author_id/)
})