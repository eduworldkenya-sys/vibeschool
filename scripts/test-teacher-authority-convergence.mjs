import fs from 'node:fs'
import assert from 'node:assert/strict'

const layout=fs.readFileSync('app/teacher/layout.tsx','utf8')
const pulse=fs.readFileSync('app/teacher/pulse/page.tsx','utf8')
const assessment=fs.readFileSync('app/teacher/assessment/page.tsx','utf8')
const twin=fs.readFileSync('lib/twin/core.ts','utf8')
const desk=fs.readFileSync('app/teacher/teach-today/page.tsx','utf8')
const marking=fs.readFileSync('supabase/migrations/20260925201500_fix_marking_centre_summary_alias_scope.sql','utf8')

assert.match(layout,/get_my_teacher_school_context/)
assert.doesNotMatch(layout,/selectTwinRoleBinding\(authority,\s*["']teacher["']/)
assert.match(pulse,/get_my_teacher_school_context/)
assert.doesNotMatch(pulse,/memberSchoolIds\[0\]/)
assert.doesNotMatch(pulse,/profileRes\.data\?\.school_id/)
assert.match(pulse,/rpc\(["']set_my_active_teacher_school["']/)
assert.doesNotMatch(pulse,/activeSchoolIdRef/)
assert.doesNotMatch(pulse,/requestedSchoolId/)
assert.match(assessment,/rpc\(['"]get_my_teacher_school_context['"]\)/)
assert.match(assessment,/\.eq\(['"]school_id['"],\s*sid\)/)
assert.doesNotMatch(assessment,/from\(['"]school_members['"]\)/)
assert.doesNotMatch(assessment,/from\(['"]teacher_profiles['"]\)/)
assert.doesNotMatch(assessment,/select\(['"]school_id['"]\)\.eq\(['"]id['"],\s*user\.id\)/)
assert.match(twin,/get_my_teacher_school_context/)
assert.match(twin,/authorizedTeacherSchoolIds\.has\(membership\.school_id\)/)
assert.match(desk,/get_my_teacher_school_context/)
assert.doesNotMatch(desk,/href: ["']\/teacher\/curriculum["']/)
assert.match(desk,/href: ["']\/teacher\/subjecthub["']/)
assert.match(desk,/label: ["']Progress Record["']/)
assert.match(marking,/owned_attempts/)
assert.doesNotMatch(marking,/filter \(where aa\./)

// Behavioral authority model: server active school is the only selection, and
// assignments/classes/subjects from another school cannot enter the surface.
const resolveSurface = (context, assignments, classes, subjects) => {
  const schoolId = context?.active_school_id ?? null
  if (!schoolId) return { schoolId: null, assignments: [], classes: [], subjects: [] }
  const scopedAssignments = assignments.filter((row) => row.school_id === schoolId)
  const classIds = new Set(scopedAssignments.map((row) => row.class_id))
  const subjectIds = new Set(scopedAssignments.map((row) => row.subject_id))
  return {
    schoolId,
    assignments: scopedAssignments,
    classes: classes.filter((row) => row.school_id === schoolId && classIds.has(row.id)),
    subjects: subjects.filter((row) => row.school_id === schoolId && subjectIds.has(row.id)),
  }
}
const fixtures = {
  assignments: [
    { school_id: 'school-a', class_id: 'class-a', subject_id: 'subject-a' },
    { school_id: 'school-b', class_id: 'class-b', subject_id: 'subject-b' },
  ],
  classes: [
    { id: 'class-a', school_id: 'school-a' },
    { id: 'class-b', school_id: 'school-b' },
  ],
  subjects: [
    { id: 'subject-a', school_id: 'school-a' },
    { id: 'subject-b', school_id: 'school-b' },
  ],
}
assert.deepEqual(resolveSurface(null, fixtures.assignments, fixtures.classes, fixtures.subjects), {
  schoolId: null, assignments: [], classes: [], subjects: [],
})
assert.deepEqual(resolveSurface({ active_school_id: 'school-a' }, fixtures.assignments, fixtures.classes, fixtures.subjects), {
  schoolId: 'school-a',
  assignments: [fixtures.assignments[0]],
  classes: [fixtures.classes[0]],
  subjects: [fixtures.subjects[0]],
})
assert.equal(resolveSurface({ active_school_id: 'wrong-school' }, fixtures.assignments, fixtures.classes, fixtures.subjects).assignments.length, 0)
assert.equal(resolveSurface({ active_school_id: 'school-a' }, [fixtures.assignments[1]], fixtures.classes, fixtures.subjects).classes.length, 0)
console.log('teacher authority convergence contract: PASS')
