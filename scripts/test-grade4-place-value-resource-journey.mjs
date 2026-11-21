import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const hook = read('lib/learn/useCertifiedInteractiveResources.ts')
const page = read('app/learn/resources/[resourceId]/page.tsx')
const outline = read('components/learn/SubjectTextbookOutline.tsx')
const shelf = read('components/learn/CertifiedResourceLinks.tsx')
const school = read('components/learn/SchoolLearnLibrary.tsx')
const teacher = read('app/teacher/resources/page.tsx')
const studio = read('components/learn/PlaceValueResourceStudio.tsx')

// Mandatory root AND immutable version release gates for discovery and read.
for (const file of [hook, page]) {
  for (const gate of [
    ".eq('status', 'active')",
    ".eq('visibility', 'public')",
    ".eq('owner_type', 'platform')",
    ".eq('lifecycle_status', 'certified')",
    ".not('certified_at', 'is', null)",
  ]) assert.ok(file.includes(gate), `Missing canonical release gate: ${gate}`)
  assert.ok(file.includes('isPlaceValueStudioPayload'), 'Unknown payloads must not be advertised as interactive')
}
assert.ok(page.includes(".eq('id', versionId).eq('resource_id', root.id)"),
  'Reader must verify exact certified version belongs to the root')
assert.ok(!page.includes('service_role') && !hook.includes('service_role'), 'Public reads must never use elevated credentials')
assert.ok(outline.includes('releasedInteractiveResources.filter(item => item.subStrandId === topic.id)'),
  'Textbook topic must be matched by canonical sub-strand ID, not title guesses')
assert.ok(outline.includes('relatedResources.length > 0'),
  'Uncertified resources must never create a phantom textbook resource')
assert.ok(school.includes('<CertifiedResourceLinks grade={grade} subject={activeName}/>'),
  'Subject resource tab must discover released interactive materials')
assert.ok(teacher.includes('<CertifiedResourceLinks grade="Grade 4" subject="Mathematics" hideWhenEmpty />'),
  'Teacher Teaching Library should expose certified Grade 4 Mathematics resource')
assert.ok(shelf.includes("status !== 'ready' || resources.length === 0"),
  'Teacher shelf must remain empty for unpublished work')

// The demonstration game remains formative. Grade 4 official answers go
// through the already released canonical Topic Practice / My Mistakes engine.
assert.ok(page.includes('topic=Place%20Value%20%26%20Total%20Value'),
  'The approved topic title must match the existing assessment metadata')
assert.ok(page.includes('/student/vibelearn/mistakes'))
assert.ok(page.includes('/student/vibelearn/topic-practice/progress'))
assert.ok(page.includes('not a scored assessment'))
assert.ok(studio.includes('PracticeGame') && studio.includes('TeacherSlides'))
assert.ok(!page.includes('insert(') && !hook.includes('insert('),
  'Browsing tools must not create substitute progress or score records')
console.log('Certified Grade 4 Mathematics resource-to-practice journey contract: PASS')
