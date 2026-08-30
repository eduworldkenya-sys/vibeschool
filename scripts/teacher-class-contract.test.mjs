import assert from 'node:assert/strict'
import fs from 'node:fs'

const options = fs.readFileSync('lib/teacher/classOptions.ts', 'utf8')
const form = fs.readFileSync('components/teacher/TeacherClassForm.tsx', 'utf8')
const hub = fs.readFileSync('app/teacher/classhub/page.tsx', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260829235500_teacher_self_service_class_assignments.sql', 'utf8')

for (const level of ['PP1', 'Grade 6', 'Grade 9', 'Grade 10', 'Grade 12', 'Form 1', 'Form 4']) {
  assert.match(options, new RegExp(`['"]${level}['"]`), `missing ${level}`)
  assert.match(migration, new RegExp(`'${level}'`), `database does not allow ${level}`)
}

assert.match(hub, /Add or join class/, 'My Classes must expose the action')
assert.match(form, /create_teacher_class_assignment/, 'form must use the canonical RPC')
assert.match(form, /p_is_class_teacher/, 'form must preserve teacher role')
assert.match(migration, /sm\.school_id = p_school_id/, 'RPC must enforce same-school membership')
assert.match(migration, /sm\.profile_id = v_uid/, 'RPC must bind assignment to the caller')
assert.match(migration, /teacher_authority_required/, 'RPC must enforce active teacher authority')
assert.match(migration, /uq_classes_school_normalized_name_stream/, 'class identity must be duplicate protected')
assert.match(migration, /pg_advisory_xact_lock/, 'concurrent class creation must be serialized')
assert.match(migration, /global_subject_id/, 'school subjects must retain the canonical global link')
assert.match(migration, /uq_global_subject_normalized_name/, 'global subject identity must be duplicate protected')
assert.match(migration, /revoke all[\s\S]*from public, anon, service_role/, 'privileged RPC must not be broadly executable')
assert.match(migration, /grant execute[\s\S]*to authenticated/, 'authenticated teachers need explicit execute access')
assert.match(migration, /create or replace function public\.onboard_teacher_class[\s\S]*create_teacher_class_assignment/, 'legacy onboarding must use the canonical class RPC')

console.log('teacher class contract: PASS')
