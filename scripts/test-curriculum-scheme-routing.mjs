import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view=readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
const launcher=readFileSync(new URL('../app/teacher/scheme/generate/page.tsx',import.meta.url),'utf8')

// The real launcher explicitly rejects a URL missing any of these three.
assert.match(launcher,/if \(!classId \|\| !subjectId \|\| !schemeId\)/)
for(const field of ['schemeId:item.id','classId:selectedClass','subjectId:selectedSubject']){
  assert.ok(view.includes(field), 'Missing lesson launcher context: '+field)
}
assert.ok(view.includes('prepareSchemeLesson(linked)'), 'Curriculum Plan button must use a complete context')
assert.ok(view.includes('prepareSchemeLesson(item)'), 'Scheme Prepare lesson button must use a complete context')
assert.ok(!view.includes('/teacher/scheme/generate?schemeId='), 'Do not use the broken ID-only link')
assert.ok(view.includes('canonicalRowIds.has(item.curriculum_id)'), 'Do not invent a canonical curriculum link')
assert.ok(view.includes('curriculumId:item.curriculum_id'), 'Linked scheme must preserve canonical curriculum identity')
assert.ok(view.includes('setSelectedStrand(row.strand'), 'Curriculum should reveal its linked strand')
assert.ok(view.includes('setShowEnglishLegacy(true)'), 'Linked record should be visible even in the new English map')
assert.ok(view.includes('No verified curriculum link for this scheme lesson'), 'Unlinked schemes must be labelled')
assert.ok(view.includes("supabase.rpc('commit_curriculum_scheme'"), 'Do not replace canonical commit permissions')
console.log('Teacher curriculum-to-scheme routing checks passed')
