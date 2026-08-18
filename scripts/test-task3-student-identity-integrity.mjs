import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260819010000_task3_student_identity_provisioning_integrity.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')

function must(pattern, message) {
  if (!pattern.test(migration)) throw new Error(message)
}

function mustNot(pattern, message) {
  if (pattern.test(migration)) throw new Error(message)
}

must(/student_provisioning_receipts/i, 'missing retry-safe provisioning receipt ledger')
must(/primary key \(actor_id, operation, payload_hash\)/i, 'provisioning receipt is not deterministically unique')
must(/student_external_identifier_conflicts/i, 'missing ambiguous external-identifier quarantine')
must(/Reused admission identifiers are conflicts, not automatic learner merge evidence/i, 'historical identifier policy must forbid guessed merges')
must(/students_one_current_enrollment_uidx[\s\S]*on public\.student_classes\(student_id\)[\s\S]*where is_current=true/i, 'missing one-current-enrollment invariant')
must(/class_join_requests_one_pending_uidx[\s\S]*where status='pending'/i, 'missing pending join request deduplication')

must(/create or replace function public\.is_teacher_of_student[\s\S]*join public\.school_members sm[\s\S]*sm\.role='teacher'/i, 'teacher-student predicate must require live teacher membership')
must(/tc\.teacher_id=auth\.uid\(\)/i, 'teacher-student predicate must bind the caller')
must(/sc\.is_current=true/i, 'teacher-student predicate must require current learner enrollment')

must(/create or replace function public\.teacher_add_student[\s\S]*pg_advisory_xact_lock/i, 'teacher provisioning must serialize retries')
must(/teacher_add_student[\s\S]*student_provisioning_receipts/i, 'teacher provisioning must persist retry receipt')
must(/admission_identifier_required_for_retry_safe_provisioning/i, 'teacher/admin roster creation must reject identity-weak provisioning')
must(/admission_identifier_conflict/i, 'reused admission identifiers must fail closed')

must(/create or replace function public\.admin_add_student[\s\S]*pg_advisory_xact_lock/i, 'admin provisioning must serialize retries')
must(/admin_add_student[\s\S]*student_provisioning_receipts/i, 'admin provisioning must persist retry receipt')

must(/create or replace function public\.create_child_for_parent[\s\S]*pg_advisory_xact_lock/i, 'parent child provisioning must serialize retries')
must(/parent_create_child[\s\S]*student_provisioning_receipts/i, 'parent provisioning must persist retry receipt')
must(/insert into public\.students\(name,date_of_birth,class_id,created_by\)[\s\S]*values\(trim\(p_name\),p_dob,null,v_user_id\)/i, 'pending parent class selection must not become current student class state')
mustNot(/create_child_for_parent[\s\S]{0,3500}insert into public\.student_classes/i, 'parent creation must not self-enroll a learner before teacher approval')

must(/revoke all privileges on table public\.student_provisioning_receipts from public, anon, authenticated/i, 'provisioning receipts must be service-only')
must(/revoke all privileges on table public\.student_external_identifier_conflicts from public, anon, authenticated/i, 'identifier conflict evidence must be service-only')

const semantic = fs.readFileSync('supabase/migrations/20260818184000_student_one_semantic_identity_closure.sql', 'utf8')
if (!/public\.students/i.test(semantic) || !/student_id/i.test(semantic)) {
  throw new Error('canonical Student=1 semantic closure migration is missing')
}

console.log('Task 3 Student Identity Integrity contract: PASS')
