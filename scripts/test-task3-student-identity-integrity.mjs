import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260819010000_task3_student_identity_provisioning_integrity.sql', 'utf8')
const boundary = fs.readFileSync('supabase/migrations/20260819011000_task3_student_teacher_boundary_semantic_closure.sql', 'utf8')

function expect(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message)
}

function reject(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message)
}

expect(migration,/student_provisioning_receipts/i,'missing retry-safe provisioning receipt ledger')
expect(migration,/primary key \(actor_id, operation, payload_hash\)/i,'provisioning receipt is not deterministically unique')
expect(migration,/student_external_identifier_conflicts/i,'missing ambiguous external-identifier quarantine')
expect(migration,/Reused admission identifiers are conflicts, not automatic learner merge evidence/i,'historical identifier policy must forbid guessed merges')
expect(migration,/students_one_current_enrollment_uidx[\s\S]*on public\.student_classes\(student_id\)[\s\S]*where is_current=true/i,'missing one-current-enrollment invariant')
expect(migration,/class_join_requests_one_pending_uidx[\s\S]*where status='pending'/i,'missing pending join request deduplication')

expect(migration,/create or replace function public\.is_teacher_of_student[\s\S]*join public\.school_members sm[\s\S]*sm\.role='teacher'/i,'teacher-student predicate must require live teacher membership')
expect(migration,/tc\.teacher_id=auth\.uid\(\)/i,'teacher-student predicate must bind caller')
expect(migration,/sc\.is_current=true/i,'teacher-student predicate must require current enrollment')

expect(migration,/create or replace function public\.teacher_add_student[\s\S]*pg_advisory_xact_lock/i,'teacher provisioning must serialize retries')
expect(migration,/teacher_add_student[\s\S]*student_provisioning_receipts/i,'teacher provisioning must persist retry receipt')
expect(migration,/admission_identifier_required_for_retry_safe_provisioning/i,'teacher/admin roster creation must reject identity-weak provisioning')
expect(migration,/admission_identifier_conflict/i,'reused admission identifiers must fail closed')
expect(migration,/create or replace function public\.admin_add_student[\s\S]*pg_advisory_xact_lock/i,'admin provisioning must serialize retries')
expect(migration,/admin_add_student[\s\S]*student_provisioning_receipts/i,'admin provisioning must persist retry receipt')
expect(migration,/create or replace function public\.create_child_for_parent[\s\S]*pg_advisory_xact_lock/i,'parent child provisioning must serialize retries')
expect(migration,/parent_create_child[\s\S]*student_provisioning_receipts/i,'parent provisioning must persist retry receipt')
expect(migration,/insert into public\.students\(name,date_of_birth,class_id,created_by\)[\s\S]*values\(trim\(p_name\),p_dob,null,v_user_id\)/i,'pending parent class selection must not become current student class state')
reject(migration,/create_child_for_parent[\s\S]{0,3500}insert into public\.student_classes/i,'parent creation must not self-enroll before teacher approval')
expect(migration,/revoke all privileges on table public\.student_provisioning_receipts from public, anon, authenticated/i,'provisioning receipts must be service-only')
expect(migration,/revoke all privileges on table public\.student_external_identifier_conflicts from public, anon, authenticated/i,'identifier conflict evidence must be service-only')

expect(boundary,/create or replace function public\.is_live_teacher_class[\s\S]*join public\.school_members sm[\s\S]*sm\.role='teacher'/i,'live teacher class helper must prove school membership')
expect(boundary,/create or replace function public\.is_live_teacher_subject[\s\S]*join public\.school_members sm[\s\S]*sm\.role='teacher'/i,'live teacher subject helper must prove school membership')
expect(boundary,/create policy teacher_read on public\.students[\s\S]*is_teacher_of_student\(id\)/i,'student roster RLS must use canonical teacher-student helper')
expect(boundary,/drop policy if exists student_profiles_parent_read[\s\S]*drop policy if exists student_profiles_teacher_read/i,'legacy profile/student confused policies must be removed')
expect(boundary,/s\.profile_id=student_profiles\.profile_id[\s\S]*is_parent_of_student\(s\.id\)/i,'student profile parent read must resolve account to canonical learner')
expect(boundary,/s\.profile_id=student_profiles\.profile_id[\s\S]*is_teacher_of_student\(s\.id\)/i,'student profile teacher read must resolve account to canonical learner')
reject(boundary,/sc\.student_id\s*=\s*student_profiles\.profile_id/i,'student_id may never be compared directly to student_profiles.profile_id')
expect(boundary,/attendance_teacher_read[\s\S]*is_live_teacher_class[\s\S]*is_teacher_of_student/i,'attendance teacher read must require live class and canonical learner')
expect(boundary,/cbc_teacher_read[\s\S]*is_live_teacher_subject[\s\S]*is_teacher_of_student/i,'CBC teacher read must require live subject and canonical learner')
expect(boundary,/Teachers view exam results for their classes[\s\S]*is_live_teacher_subject[\s\S]*is_teacher_of_student/i,'exam result teacher read must require live subject and canonical learner')
expect(boundary,/assessment_attempts_teacher_read[\s\S]*is_teacher_of_student/i,'assessment attempt teacher read must require canonical learner authority')
expect(boundary,/homework_submissions_teacher[\s\S]*is_teacher_of_student/i,'homework teacher path must require canonical learner authority')
expect(boundary,/psl_teacher_read[\s\S]*is_teacher_of_student/i,'parent-student teacher read must require canonical learner authority')
expect(boundary,/claim_codes_teacher[\s\S]*is_teacher_of_student/i,'claim code teacher path must require canonical learner authority')
expect(boundary,/mastery_teacher_read[\s\S]*is_teacher_of_student/i,'mastery teacher read must require canonical learner authority')

const semantic = fs.readFileSync('supabase/migrations/20260818184000_student_one_semantic_identity_closure.sql','utf8')
if (!/public\.students/i.test(semantic) || !/student_id/i.test(semantic)) throw new Error('canonical Student=1 semantic closure migration is missing')

console.log('Task 3 Student Identity Integrity contract: PASS')
