# Canonical Student Identity — Handover Log

Date: 2026-08-18
Branch: `fix/canonical-student-identity-20260818`

## Mission

Make `public.students.id` the durable learner identity wherever a column is semantically named `student_id`, while treating `auth.uid()` / `profiles.id` strictly as account/profile identity.

## Confirmed production defects at start

- Modern `student_learning_events.student_id` resolves through `funhub_get_student_id()` to `students.id`.
- `student_twin_state_snapshots.student_id` also belongs to `students.id`.
- Older KCSE/revision/practice policies still compare `student_id = auth.uid()`.
- `student_exam_readiness_state`, `student_kcse_mock_sessions`, and `student_kcse_subject_confidence` lack canonical student foreign-key enforcement.
- Historical migration `20260818013000_pilot_identity_domain_semantic_repair.sql` explicitly preserved profile/auth-keyed meanings for several learner tables. That was safe for the pilot authorization repair but is not the desired long-term identity contract.

## Safety rules

- No Vercel trigger while work is incomplete.
- Do not mutate production data before a forward migration is reviewed and the historical UUID mapping is proven unambiguous.
- Preserve school-created/unclaimed learners; claiming attaches an account to an existing learner and must not replace the learner ID.
- Every data repair must fail closed if a profile UUID cannot resolve to exactly one active student.

## Work plan

1. Inventory every student-bearing FK, RLS policy, RPC, view, trigger and writer.
2. Define one canonical resolver contract.
3. Prepare forward-only migration that reconciles legacy profile-keyed student tables.
4. Rewrite RLS/RPC semantics around canonical student IDs.
5. Add FK/uniqueness guards and regression checks.
6. Verify database advisors and production-safe invariants.
7. Reconcile with current `main`, certify, then open/merge only when ready.

## Log

- Created dedicated branch from current `main`.
- Verified production project is healthy on Postgres 17.
- Verified active split-brain RLS: modern learning events use canonical resolver while KCSE/revision/practice tables use `auth.uid()` directly.
- Verified `funhub_get_student_id()` currently resolves `students.id` from active `students.profile_id = auth.uid()`.
- Began migration archaeology; legacy pilot semantic repair explicitly documents mixed identity domains, confirming this is an incomplete platform migration rather than a single accidental policy.
