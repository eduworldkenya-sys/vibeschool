# Pilot Authority Chain Reconstruction

## Mission

Reconstruct on repository `main` the exact production migration sequence that closed the pilot authorization defects discovered on 2026-08-17, then certify the resulting authority semantics on a disposable database.

This branch does **not** apply any new production mutation. Production already records all seven versions in `supabase_migrations.schema_migrations`.

## Reconstructed production ledger

1. `20260817131454_pilot_authority_teacher_classes`
2. `20260817131939_pilot_identity_exercise_submissions_authority`
3. `20260817132001_pilot_identity_domain_rls_closure`
4. `20260817145640_pilot_exam_result_authority_scope`
5. `20260817150023_pilot_authority_consequential_audit_lineage`
6. `20260817160156_pilot_pending_admin_authority_quarantine`
7. `20260817160629_pilot_exercise_teacher_class_authority`

The SQL was recovered from the production migration ledger rather than reconstructed from memory.

## Authority invariants

- authenticated clients have read-only direct table grants on `teacher_classes`; assignment mutation is mediated by RLS and requires school owner/admin authority plus a real teacher membership for the assigned teacher;
- `students.id` is never confused with `auth.uid()`/`profiles.id` in student-domain RLS;
- exercise submissions bind self-service to the authenticated learner profile and active class enrollment;
- teacher exercise/submission authority requires matching teacher assignment to the exercise class/school;
- exam-result writes bind teacher, school, class, subject, enrolled learner and unlocked exam context;
- consequential claim/assessment/exam-result mutations emit audit lineage through a non-client-callable fixed-search-path trigger function;
- active admin identity requires authoritative admin/owner school membership and incomplete provisioning is quarantined.

## TBL-011 correction

The previous isolated-rebuild verifier treated policy names as security semantics. It rejected `pol_teacher_classes_insert/update/delete` even after those names were intentionally recreated with the hardened owner/admin + teacher-membership predicates. The verifier now checks the final grants and policy predicates instead of declaring a policy unsafe solely from its name.

## Promotion gate

Do not merge until:

1. full clean rebuild succeeds from repository migrations;
2. TBL-011 final-state verification passes;
3. `pilot_authority_chain_verify.sql` passes;
4. migration-security and production-build gates pass on the exact head;
5. no production migration is re-applied or migration history manually altered.
