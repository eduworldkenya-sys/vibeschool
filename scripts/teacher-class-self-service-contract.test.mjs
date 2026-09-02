import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260902095200_teacher_class_self_service_current.sql', 'utf8')
const form = fs.readFileSync('components/teacher/TeacherClassForm.tsx', 'utf8')
const classHub = fs.readFileSync('app/teacher/classhub/page.tsx', 'utf8')
const addPage = fs.readFileSync('app/teacher/classhub/add/page.tsx', 'utf8')
const onboarding = fs.readFileSync('app/teacher/onboarding/class/page.tsx', 'utf8')

assert.match(migration, /create or replace function public\.create_teacher_class_assignment/i)
assert.match(migration, /security definer/i)
assert.match(migration, /set search_path = public, auth, pg_temp/i)
assert.match(migration, /teacher_school_membership_required/i)
assert.match(migration, /sm\.profile_id = v_uid[\s\S]*sm\.school_id = p_school_id[\s\S]*sm\.role::text = 'teacher'/i)
assert.match(migration, /s\.school_id is null[\s\S]*lower\(btrim\(s\.name\)\) = lower\(v_subject_input\)/i)
assert.match(migration, /pg_advisory_xact_lock/i)
assert.match(migration, /on conflict\s*\(\s*teacher_id\s*,\s*class_id\s*,\s*subject_id\s*\)\s*do update/i)
assert.match(migration, /revoke all on function public\.create_teacher_class_assignment[\s\S]*service_role/i)
assert.match(migration, /grant execute on function public\.create_teacher_class_assignment[\s\S]*to authenticated/i)

assert.match(form, /\.from\('subjects'\)\.select\('name'\)\.is\('school_id', null\)/)
assert.doesNotMatch(form, /TEACHER_SUBJECTS/)
assert.match(form, /create_teacher_class_assignment/)
assert.match(form, /class_teacher/)
assert.match(addPage, /\.from\('school_members'\)[\s\S]*\.eq\('role', 'teacher'\)/)
assert.doesNotMatch(onboarding, /teacher_profiles/)
assert.match(onboarding, /Skip — go to Teacher OS/)
assert.match(classHub, /\/teacher\/classhub\/add/)
assert.match(classHub, /Student progress/)

console.log('Teacher class self-service current-main contract: PASS')
