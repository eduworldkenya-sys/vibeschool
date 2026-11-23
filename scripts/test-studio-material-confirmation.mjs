import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../components/global/publish/PublicationEditor.tsx',import.meta.url), 'utf8')

test('Mumbi2 can explicitly acknowledge existing materials without creating new ones', () => {
  assert.match(source,/const \[materialsConfirmed, setMaterialsConfirmed\] = useState\(false\)/)
  assert.match(source,/Confirm existing lesson materials/)
  assert.match(source,/type="checkbox" checked=\{materialsConfirmed\}/)
  assert.match(source,/imageOrQuestionSummary/)
  assert.match(source,/No duplicate uploads or rewriting required/)
})
test('checkbox resets when chapter content or alignment changes', () => {
  assert.match(source,/useEffect\(\(\) => \{ setMaterialsConfirmed\(false\) \}, \[chapters, publication\?\.title, publication\?\.cbc_subject, publication\?\.cbc_grade\]\)/)
})
test('unchecked material cannot call publishing lifecycle, and does not bypass server release checks', () => {
  assert.match(source,/if \(simpleMode && !materialsConfirmed\)/)
  assert.match(source,/disabled=\{publishing \|\| publishedReadOnly \|\| !canPublish \|\| \(simpleMode && !materialsConfirmed\)\}/)
  assert.match(source,/if \(!canPublish \|\| \(simpleMode && !materialsConfirmed\)\)/)
  assert.match(source,/return publishPublication\(\)/)
  assert.match(source,/Server release checks still apply/)
})
