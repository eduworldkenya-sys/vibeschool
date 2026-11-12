import assert from 'node:assert/strict'
import fs from 'node:fs'
import { TEACHING_LIBRARY_SLOTS } from '../lib/teaching/libraryStructure.ts'
import { componentForPersonalResource, isResourceComponent, legacyTypeForComponent, mayShareResource } from '../lib/teaching/personalResourceTypes.ts'

assert.equal(TEACHING_LIBRARY_SLOTS.length, 15)
const legalDatabaseTypes = new Set(['notes', 'assignment', 'video', 'link', 'quiz'])
for (const item of TEACHING_LIBRARY_SLOTS) {
  assert.ok(isResourceComponent(item.id), 'all components have stable identity')
  assert.ok(legalDatabaseTypes.has(legacyTypeForComponent(item.id)), item.id + ' must use a legal legacy storage type')
  assert.equal(componentForPersonalResource({ component_type: item.id, type: 'link' }), item.id)
}
assert.equal(legacyTypeForComponent('lesson-notes'), 'notes')
assert.equal(legacyTypeForComponent('quizzes'), 'quiz')
assert.equal(legacyTypeForComponent('homework'), 'assignment')
assert.equal(legacyTypeForComponent('demonstrations', true), 'video')
assert.equal(componentForPersonalResource({ type: 'quiz' }), 'quizzes', 'legacy quiz fallback retained')
assert.equal(componentForPersonalResource({ type: 'link' }), null, 'generic links must not be guessed')
assert.equal(mayShareResource({ title: 'Draft with no content' }), false)
assert.equal(mayShareResource({ title: 'Ready', content: 'Structured notes' }), true)
assert.equal(mayShareResource({ title: 'Ready', external_url: 'https://vibeschool.co.ke' }), true)
assert.equal(mayShareResource({ title: 'Invalid', external_url: 'javascript:alert(1)' }), false)

const sql = fs.readFileSync('supabase/migrations/20261112065326_teacher_resource_draft_share_and_component_link.sql','utf8')
const editor = fs.readFileSync('components/teacher/TeacherResourceEditor.tsx','utf8')
const teacher = fs.readFileSync('app/teacher/resources/page.tsx','utf8')
const student = fs.readFileSync('app/student/resources/page.tsx','utf8')
const library = fs.readFileSync('components/teacher/TeachingLibraryStructure.tsx','utf8')
const types = fs.readFileSync('lib/database.types.ts','utf8')

for (const value of [
  "publication_status text not null default 'draft'",
  "publication_status = 'shared'",
  "security_invoker = true",
  'drop policy if exists resources_student_view',
  'scheme_lesson_id uuid references',
  'validate_teacher_resource_context',
  'tc.subject_id = new.subject_id',
  's.teacher_id = new.teacher_id',
  's.class_id = new.class_id',
  "revoke all on public.resources from anon",
  "grant select on public.student_accessible_resources to authenticated",
]) assert.ok(sql.includes(value), 'Security or linkage migration invariant missing: ' + value)
assert.ok(sql.indexOf('where r.publication_status = \'shared\'') > -1, 'student view never surfaces drafts')
for (const item of TEACHING_LIBRARY_SLOTS) assert.ok(sql.includes("'"+item.id+"'"), item.id+' must be recognized by database')
for (const token of [
  "publication_status: 'draft'",
  "is_school_wide: false",
  "scheme_lesson_id: schemeId || null",
  "Save private draft",
  ".eq('teacher_id', teacherId)",
  "getUser()",
  "availableScheme",
]) assert.ok(editor.includes(token), 'Authoring contract missing: '+token)
for (const token of ["setSharingStatus", "Share with class", "Unshare", "onSavedResource", "My teaching materials"]) {
  assert.ok(teacher.includes(token), 'Teacher lifecycle missing: '+token)
}
assert.ok(library.includes('onAddPersonalResource(slot.id)'), 'all 15 slots permit optional creation')
assert.ok(library.includes('componentForPersonalResource(item)'), 'teacher saved resources must use canonical component')
assert.ok(!student.includes('readCache<'), 'student app must not retain unshared class content in local caches')
assert.ok(!student.includes('writeCache('), 'student app must not persist shared content after unshare')
assert.ok(student.includes('clearCache("lessons", identity.studentId)'), 'legacy locally cached class content must be purged')
assert.ok(student.includes('student_accessible_resources'), 'student reader uses RLS-protected published view')
for (const token of ['publication_status: string', 'component_type: string | null', 'scheme_lesson_id: string | null']) {
  assert.ok(types.includes(token), 'typed DB contract missing: '+token)
}
console.log('Teacher resource authoring contract PASS: 15 types, draft-by-default, explicit share, Scheme checks, student cache safety.')


for (const rule of [
  "const [loadedForStudentId, setLoadedForStudentId]",
  "const activeStudentId = identity.studentId",
  "setLoadedForStudentId(null)",
  "setLoadedForStudentId(activeStudentId)",
  "loadedForStudentId === identity.studentId",
  "loadedForStudentId !== identity.studentId",
  "setResources([])",
]) assert.ok(student.includes(rule), 'Shared-device learner isolation missing: ' + rule)
assert.ok(student.includes('const visibleResources ='), 'Study Room must render only identity-bound resources')
