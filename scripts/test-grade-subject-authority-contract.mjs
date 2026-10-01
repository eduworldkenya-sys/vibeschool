import assert from 'node:assert/strict'
import fs from 'node:fs'
const m=fs.readFileSync('supabase/migrations/20261001122500_canonical_grade_subject_authority.sql','utf8')
assert.match(m,/create table if not exists public\.grade_subject_authority/)
for(const grade of ['Grade 10','Grade 11','Grade 12']) assert.ok(m.includes("'"+grade+"'"),grade+' must be catalogued')
for(const subject of ['English','Kiswahili','Core Mathematics','Essential Mathematics','Community Service Learning','Biology','Chemistry','Physics','Business Studies','Geography']) assert.ok(m.includes("'"+subject+"'"),subject+' must be catalogued')
assert.match(m,/get_allowed_teaching_subjects/)
assert.match(m,/from public\.grade_subject_authority g/)
assert.match(m,/create_teacher_class_assignment/)
assert.match(m,/invalid_subject_for_level/)
assert.doesNotMatch(m,/select 1 from public\.curriculum c where c\.grade=v_grade and lower\(btrim\(c\.subject\)\)=lower\(v_subject_input\)/)
console.log('Canonical grade-subject authority contract passed')
