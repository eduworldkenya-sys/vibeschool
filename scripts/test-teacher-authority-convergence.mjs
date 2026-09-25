import fs from 'node:fs'
import assert from 'node:assert/strict'

const layout=fs.readFileSync('app/teacher/layout.tsx','utf8')
const pulse=fs.readFileSync('app/teacher/pulse/page.tsx','utf8')
const twin=fs.readFileSync('lib/twin/core.ts','utf8')
const marking=fs.readFileSync('supabase/migrations/20260925201500_fix_marking_centre_summary_alias_scope.sql','utf8')

assert.match(layout,/get_my_teacher_school_context/)
assert.doesNotMatch(layout,/selectTwinRoleBinding\(authority,\s*["']teacher["']/)
assert.match(pulse,/get_my_teacher_school_context/)
assert.doesNotMatch(pulse,/memberSchoolIds\[0\]/)
assert.doesNotMatch(pulse,/profileRes\.data\?\.school_id/)
assert.match(twin,/get_my_teacher_school_context/)
assert.match(twin,/authorizedTeacherSchoolIds\.has\(membership\.school_id\)/)
assert.match(marking,/owned_attempts/)
assert.doesNotMatch(marking,/filter \(where aa\./)
console.log('teacher authority convergence contract: PASS')
