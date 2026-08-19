# Task 3 — Canonical Student Identity, Provisioning & Academic Identity Final Handover

Date: 2026-08-19
Branch: `agent/task3-student-identity-integrity`
PR: #283
Promotion order: `T2 → T1 → T3 → T8 → T4 → T5 → T6 → T7`
Task 2: merged before Task 3 reconciliation.
Task 1 canonical foundation: merged.
Task 1 P0 authority follow-up: merged to `main` at `30dc14a4fff04ed671e034cb4c3be9156dd3d976` before final Task 3 certification.

## Mission contract

- `auth.users.id` is authentication account identity.
- `profiles.id` is VibeSchool account/profile identity.
- `public.students.id` is the durable canonical learner-domain identity.
- A domain `student_id` means `public.students.id` unless a documented adapter explicitly says otherwise.
- `students.profile_id` is the explicit account → canonical learner bridge. Account and learner UUIDs are never treated as interchangeable merely because both are UUIDs.
- `student_classes.id` is enrollment-record identity; `student_classes.student_id` is canonical learner identity.
- Academic placement is temporal relationship data. Grade, class, stream, school, teacher, academic year and term do not become permanent learner identity.
- Admission numbers are school-scoped external identifiers and never sufficient learner-merge evidence by themselves.
- Ambiguity fails closed: quarantine > guess > merge.

## Exact-current-main reconciliation

Task 3 started before Task 1 final authority work landed. After Task 1 merged, exact-current `main` was merged into the isolated Task 3 branch through reconciliation PR #296. Task 3 then reconciled the changed auth/profile/claim/parent authority contracts instead of preserving stale downstream assumptions.

The key semantic reconciliation is Parent identity establishment:

- Earlier Task 3 work made `create_child_for_parent()` retry-safe.
- Task 1 production attack testing established the stronger canonical invariant: an ordinary Parent must not manufacture a canonical learner or relationship directly.
- Task 3 therefore adopts Task 1 as authority.
- The legacy `create_child_for_parent(text,date,uuid)` signature is retained only as a fail-closed compatibility tombstone.
- The canonical tombstone raises `verified_parent_child_relationship_required` and execution is revoked from `PUBLIC`, `anon`, `authenticated` and `service_role`.
- Parent linking must proceed through verified claim/relationship evidence.
- Historical provisioning receipts remain evidence; they do not authorize new Parent-created learners.

## Recomputed production baseline — read only

Immediately during reconciliation, production was re-read rather than relying on historical Task 3 numbers:

- Active canonical learners: 116.
- Active Student-role profiles: 10.
- Canonical learners linked to a profile: 1.
- Roster/unclaimed learners: 115.
- Student-role profiles without deterministic learner mapping: 9.
- Duplicate active profile → learner mappings: 0.
- Current `student_classes` enrollments: 70.
- Learners with multiple current enrollments: 0.
- Current class/school mismatches: 0.
- Orphan current enrollments: 0.
- Same-school reused admission-number conflict groups: 4.
- Learners with multiple Student claimants: 0.

The four admission-number groups remain conflict evidence. No learner is merged or deleted to improve statistics.

## Identity repairs

### Canonical account resolution

`current_student_id()` remains the canonical self resolver: caller identity derives internally from `auth.uid()`, ambiguity is rejected, missing identity fails safely, and editable user metadata is not authority.

Legacy `funhub_get_student_id()` is unified onto the canonical resolver rather than independently selecting a learner with arbitrary `LIMIT 1` semantics.

### Roster provisioning

`teacher_add_student` and `admin_add_student` are hardened with:

- authenticated caller binding;
- school authority checks;
- school-scoped admission identifier requirement;
- deterministic request payload identity;
- transaction advisory locking;
- service-only provisioning receipts;
- replay recovery to the same canonical learner;
- explicit conflict denial when an admission identifier already belongs to a different existing school learner;
- no name/DOB-based implicit merge.

### Provisioning evidence

`student_provisioning_receipts` records the logical operation, actor, payload identity and resulting canonical learner. It is RLS-enabled and direct browser-role access is revoked.

### Identifier conflict quarantine

`student_external_identifier_conflicts` preserves reused external identifier evidence with affected learners, school, normalized identifier, status and evidence. It is service-only. Existing ambiguous records are preserved rather than rewritten.

### Current enrollment

A partial unique index enforces at most one `student_classes` row per learner where `is_current=true`. Historical enrollment rows remain represented independently.

A second partial unique index prevents duplicate active pending class join requests.

### Teacher → learner authorization

`is_teacher_of_student()` requires all of:

- caller bound to `auth.uid()`;
- current learner enrollment;
- matching teacher class assignment;
- same school;
- live `school_members.role='teacher'` membership.

`is_live_teacher_class()` and `is_live_teacher_subject()` support the same current-authority model. Student, attendance, assessments/results, homework/submissions, learning evidence, parent relationship surfaces, claim codes, mastery and learner-outcome teacher policies are rebound to canonical learner identity plus current teacher authority where applicable.

### Student profile semantic repair

Legacy policies that confused `student_profiles.profile_id` with learner `student_id` are removed. Parent/teacher access first resolves profile identity to `students.profile_id -> students.id`, then evaluates relationship authority against the canonical learner.

### Historical recovery

Legacy Student profiles or learner records without sufficient deterministic evidence are quarantined rather than guessed. No reconciliation is permitted from name, email, grade, free-text school or stale metadata alone.

Deterministic historical parent relationship restoration is limited to strong existing provenance. Unprovable inert unenrolled learners remain represented in service-only recovery state; learner rows and history are not deleted.

## Repository reconstruction parity

Task 3 uncovered a production relation, `public.learner_outcomes`, that downstream Task 3 RLS hardening expected but the zero-to-current repository chain did not reconstruct at the required point.

Task 3 now reconstructs the production-compatible relation before applying learner boundary policies, with:

- canonical `student_id -> public.students(id)` FK;
- unique learner/subject/strand/outcome identity;
- deliberate RLS;
- no anonymous table access;
- authenticated access constrained by RLS;
- service-role operational access;
- Student self-read through canonical account→learner mapping;
- school-admin read through canonical admin authority;
- downstream live-teacher policy hardening.

A second reconstruction defect appeared after Task 1 reconciliation: Task 3 historically created `create_child_for_parent` using parameter names `p_name/p_dob`, while the canonical Task 1 tombstone uses `p_child_name/p_date_of_birth`. PostgreSQL does not permit input parameter renaming via `CREATE OR REPLACE`. Because production dependency inspection found no database dependants on this legacy RPC, Task 3 explicitly drops the obsolete signature and reconstructs the same SQL signature with Task 1's canonical fail-closed argument contract.

## Migrations owned by Task 3

1. `20260819010000_task3_student_identity_provisioning_integrity.sql`
2. `20260819010500_task3_profile_extension_repository_parity.sql`
3. `20260819010750_task3_parent_student_helper_repository_parity.sql`
4. `20260819010900_task3_student_learner_outcomes_repository_parity.sql`
5. `20260819011000_task3_student_teacher_boundary_semantic_closure.sql`
6. `20260819012000_task3_student_self_resolver_unification.sql`
7. `20260819013000_task3_historical_unenrolled_student_reconciliation.sql`
8. `20260819014000_task3_student_task1_parent_authority_reconciliation.sql`

## Application repair

`app/teacher/onboarding/students/page.tsx` makes the school admission identifier explicit for authoritative roster creation, does not silently proceed after a provisioning failure, and surfaces identifier conflict as a verification problem rather than creating a second learner.

## Permanent regression and failure-injection coverage

Repository/static contracts:

- `.github/workflows/task3-student-identity-integrity.yml`
- `scripts/test-task3-student-identity-integrity.mjs`
- Student Provisioning Contract
- Student One Full Journey
- Student One Legacy Identity Recovery
- Auth Gateway Contract
- Auth & Onboarding Hardening
- Supabase Migration Security Contract
- TBL-011 isolated clean rebuild
- TBL-012 repository extractor
- Task 2 Database Reconstruction Integrity
- TypeScript and Production Build Gate
- CI Production Build Contract

Real disposable-database concurrency certification:

- `.github/workflows/task3-student-identity-concurrency.yml`
- `scripts/test-task3-student-identity-concurrency.sh`

The concurrency gate reconstructs the exact branch in a disposable local Supabase and attacks the real database concurrently:

- 20 simultaneous identical Teacher provisioning requests → exactly one canonical learner, one receipt, same returned learner identity.
- 20 simultaneous identical Admin provisioning requests → exactly one canonical learner, one receipt, same returned learner identity.
- 20 simultaneous stale direct Parent child-creation attempts → all denied, zero learners created.
- 20 simultaneous current-enrollment inserts across competing classes → exactly one current enrollment survives.
- 20 simultaneous duplicate pending join requests → exactly one active pending request survives.
- two authenticated Student accounts race to claim the same canonical learner → exactly one claimant/profile binding survives.

This is a real concurrent test against PostgreSQL, not sequential simulation or source-code inspection.

## Production security boundary

Before Task 3 release, production inspection confirmed the old runtime still needed the Task 3 migration set: Teacher/Admin provisioning remained non-idempotent, legacy teacher→learner authority lacked the complete live school-membership proof, legacy FunHub learner resolution retained independent selection semantics, and the old direct Parent child-creation function still existed. This is why repository green alone is not production certification.

Task 3 release must verify after controlled migration:

- Task 3 migration history recorded;
- one-current-enrollment and pending-request constraints active;
- service-only receipt/conflict/recovery relations not directly exposed to browser roles;
- `current_student_id`/legacy resolver contract correct;
- Teacher/Admin provisioning replay-safe;
- direct Parent child creation unavailable;
- teacher/parent/admin/student cross-identity attacks fail closed;
- no existing learner loses canonical identity or historical records;
- counts and conflict groups remain explicable.

## Safety decisions

- No learner merge by guess.
- No historical learner deletion.
- No academic history reassignment from ambiguous evidence.
- No admission-number-only automatic merge.
- No Parent authority to manufacture a school learner relationship.
- No production mutation occurred during investigation/reconciliation before the release gate.
- No intentional Vercel deployment occurred during Task 3 branch engineering.

## Final exact-head promotion procedure

1. Confirm exact-current `main` has not moved. If it moved, set `RECONCILE REQUIRED`, synchronize and rerun every affected gate.
2. Require every path-triggered exact-head workflow, including real Task 3 concurrency, to complete successfully on one candidate SHA.
3. Recompute production identity/integrity drift read-only.
4. Review each Task 3 production migration and deterministic data effect before apply.
5. Apply only the Task 3-owned release set through the controlled Supabase migration path; do not replay unrelated historical repository migrations merely because production migration timestamps differ.
6. Run immediate production postflight for schema, constraints, RLS, grants, functions, learner counts, enrollment integrity and identifier conflicts.
7. Run controlled negative authorization and representative learner/teacher/admin/parent identity probes with no real learner information exposed unnecessarily.
8. Merge PR #283 only when the exact candidate and production release evidence satisfy the Task 3 stop conditions.
9. After Task 3 becomes `MERGED FOUNDATION`, mark Task 8 `RECONCILE REQUIRED` and require affected downstream tasks to reconcile before promotion.

## Completion standard

Task 3 may be marked `MERGED FOUNDATION / COMPLETE` only when the final exact-head branch, production migration/postflight, representative identity authorization evidence and handover all agree that every VibeSchool product means the same canonical learner when it stores or receives a Student ID, and no unresolved Task-3-owned P0/P1 defect remains.
