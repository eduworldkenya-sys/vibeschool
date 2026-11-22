import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('CRE and Creative Arts share the canonical Learn textbook outline for guests',()=>{
 const library=read('components/learn/SchoolLearnLibrary.tsx')
 const outline=read('components/learn/SubjectTextbookOutline.tsx')
 const api=read('app/api/learn/grade4-curriculum/route.ts')
 assert.match(library, /<SubjectTextbookOutline grade=\{grade\} subject=\{activeName\}/)
 assert.match(outline, /\/api\/learn\/grade4-curriculum/)
 assert.match(outline, /setObjectives\(\{scope,canonicalRows:null,byUnit\}\)/)
 assert.match(api, /owner-approved:grade4-cre:2026-11-22/)
 assert.match(api, /owner-paraphrase-2026-11-22/)
 assert.match(api, /\.eq\('grade','Grade 4'\)/)
 assert.doesNotMatch(api,/select\('\*'\)/)
})
