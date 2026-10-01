import assert from 'node:assert/strict'
import fs from 'node:fs'
const m=fs.readFileSync('supabase/migrations/20261001132500_reconcile_teacher_class_subject_guard.sql','utf8')
assert.match(m,/is_valid_teaching_subject_for_grade\(p_grade text,p_subject_id uuid\)/)
assert.match(m,/join public\.grade_subject_authority g/)
assert.doesNotMatch(m,/from public\.curriculum c/)
assert.doesNotMatch(m,/from public\.cbc_strands cs/)
console.log('Teacher class subject guard uses canonical grade-subject authority')
