# Student Identity — One Canonical Learner

Date: 2026-08-18
Branch: `fix/student-identity-one-canonical-20260818`
Base: `main` @ `0667f3e3b77d0a35fb55202ec2bb769845ba63e3`

## Mission
Make `public.students.id` the durable learner identity across VibeSchool. Authentication/profile UUIDs are account identities only and must never be treated as canonical learner IDs.

## Confirmed production defects
- `student_learning_events.student_id` and `student_twin_state_snapshots.student_id` use `students.id`.
- `student_mistake_notebook.student_id`, `student_practice_attempts.student_id`, and `student_revision_plan_items.student_id` still reference `profiles.id`.
- KCSE/readiness surfaces include student-bearing columns without a canonical `students(id)` FK.
- Legacy RLS/RPC paths compare `student_id = auth.uid()` and therefore encode profile/auth identity as learner identity.
- Historical wrong-domain records exist and require deterministic reconciliation before constraints are tightened.

## Invariant
`student_id` means `public.students.id`, everywhere.

Account resolution is always:
`auth.uid() -> profiles.id -> students.profile_id -> students.id`.

## Repair sequence
1. Inventory all student-bearing tables, policies, functions, triggers and views.
2. Introduce one fail-closed canonical current-student resolver.
3. Reconcile historical profile-keyed rows to canonical students where a unique active mapping exists.
4. Convert legacy student-domain FKs and RLS to `students.id`.
5. Rewrite affected RPCs to resolve canonical student identity before reads/writes.
6. Handle unclaimable/orphan rows explicitly; never guess mappings.
7. Add regression contracts where `auth.uid() != students.id`.
8. Verify teacher, parent, Twin, VibeLearn, KCSE, results and claim flows.
9. Run security/performance advisors.
10. Promote only after exact-head certification; no feature-branch Vercel deployment.

## Safety
- Production inspection is read-only until the migration is fully reviewed and deterministic.
- No deletion of learner evidence.
- Ambiguous mappings fail closed and are surfaced for reconciliation.
- School-created unclaimed students remain valid canonical learners.

## Handover log
- 2026-08-18: audit confirmed split identity domains in production and repository migration history.
- 2026-08-18: dedicated branch created from current main.
- 2026-08-18: repair programme opened; Vercel intentionally not triggered.
