import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260927214500_school_level_grade_authority.sql','utf8')
const form = fs.readFileSync('components/teacher/TeacherClassForm.tsx','utf8')

assert.match(migration,/create or replace function public\.get_allowed_teaching_levels\(p_school_id uuid\)/i)
assert.match(migration,/school_members[\s\S]*profile_id=v_uid[\s\S]*school_id=p_school_id[\s\S]*role::text='teacher'/i)
assert.match(migration,/from public\.school_levels sl/i)
assert.match(migration,/needs_resolution/i)
assert.match(migration,/invalid_class_level_for_school/i)
assert.match(migration,/get_allowed_teaching_subjects/i)
assert.match(migration,/from public\.curriculum c[\s\S]*c\.grade=v_grade/i)
assert.match(migration,/invalid_subject_for_level/i)
assert.match(migration,/on conflict\(teacher_id,class_id,subject_id\) do update/i)
assert.doesNotMatch(migration,/lower\(.*school.*name.*secondary/i)

assert.match(form,/get_allowed_teaching_levels/i)
assert.match(form,/get_allowed_teaching_subjects/i)
assert.match(form,/setGrade\(''\)/)
assert.match(form,/setSubject\(''\)/)
assert.doesNotMatch(form,/CLASS_LEVEL_GROUPS/)
assert.doesNotMatch(form,/from\('subjects'\)\.select\('name'\)/)
assert.match(form,/school_level_authority_unresolved/)
assert.match(form,/invalid_class_level_for_school/)
assert.match(form,/invalid_subject_for_level/)

console.log('school-level grade authority contract: ok')
