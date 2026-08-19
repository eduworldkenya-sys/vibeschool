# Task 5 — Student Core Journey Certification Handover

## Promotion state

**INTEGRATION GREEN CANDIDATE — FINAL EXACT-HEAD CI REQUIRED**

Task 5 has been reconstructed on exact current `main` without stale ancestry. Production remains read-only during certification.

Owner direction for this promotion: Task 8 is handled externally and is assumed for the Task 5 promotion decision.

## Candidate

- Original engineering PR: #284 (`agent/task5-student-core-journey`)
- Final conflict-resolved promotion PR: #302
- Final branch: `agent/task5-student-core-journey-reconciled`
- Exact base main at reconciliation: `98cd045d5139acbd84ad989f44ed893de434e7ee`
- Original Task 5 base: `77051a4011d7712a275f76af41efed382f017398`
- Exact candidate is always the current PR #302 head containing this manifest; any subsequent head change invalidates affected CI evidence.

## Reconciliation method

PR #284 could not merge because its ancestry was stale and GitHub reported real merge conflicts. The final candidate was therefore reconstructed directly on exact current `main` rather than force-merging or discarding current foundation work.

Comparison of original Task 5 delta with current main found only one same-path overlap: `scripts/test-auth-task1-state-machine.mjs`. That file was semantically merged, preserving all current-main Task 1 authority/recovery assertions while replacing only the obsolete split-name Teacher Profile expectation with the canonical `profiles.full_name` contract.

All other Task 5 application/test files were carried forward as their exact Task 5 content on top of current main.

## Migration convergence

Current main already contains migrations through `20260819235930` and Task 4 owns migration version `20260819023000`. The original Task 5 migration line therefore could not be promoted unchanged.

Task 5 migrations were renumbered forward in dependency order:

- `20260819235940_student_core_journey_pilot_context.sql`
- `20260819235950_student_homework_retry_integrity.sql`
- `20260819235960_student_exercise_submission_integrity.sql`
- `20260819235970_student_pilot_content_release_reconciliation.sql`
- `20260819235980_student_vibelearn_resume_grade_scope.sql`
- `20260819235990_assessment_item_grounding_rpc_reconciliation.sql`
- `20260820000010_student_actionable_notification_events.sql`
- `20260820000020_task5_notifications_school_authority_reconcile.sql`

The former Task 5 `restore_notifications_prerequisite` migration was intentionally removed from the final candidate because Task 2 now owns canonical `public.notifications` reconstruction via `20260819222000_task2_notifications_reconstruction.sql`. Task 5 consumes that foundation and owns only learner notification vocabulary/producers plus the stricter school-bound insert policy.

## Canonical auth/profile reconciliation

Production and current application truth use `public.profiles.full_name` for Teacher Profile naming. Current Teacher Profile writes canonical self-editable fields including `full_name`, `phone`, `bio`, `date_of_birth`, `gender`, and `notification_prefs` and does not depend on legacy `first_name`/`last_name` writes.

The Task 1 regression preserves the historical intersection-safe migration allowlist while asserting the current canonical save contract and retaining all current-main callback, routing, recovery, logout, authority and role-claim checks.

## Student OS repairs carried forward

- Africa/Nairobi learner-day semantics
- current-grade unfinished Continue Learning
- primary/KCSE and curriculum isolation
- recoverable Student identity provider state
- homework retry/idempotency and durable receipt semantics
- complete exercise draft/submit/feedback lifecycle
- assessment source grounding without weakening release invariants
- VibeLearn publication/subject reconciliation
- actionable/deduplicated learner notifications
- school-bound notification authorization
- Student Progress navigation and actionable notification destinations
- permanent Student Core Journey regression coverage

## Notification authority

Task 2 owns base relation/RLS reconstruction. Task 5 final policy preserves the stronger live authorization model:

- caller must be school admin for `notifications.school_id`
- recipient must have a legitimate relationship to the same school through school membership, current canonical Student/class relationship, or active Parent/student relationship
- learner/account reads and updates remain owner-scoped
- anonymous table access remains revoked

Task 5 regression explicitly checks this school binding.

## Production read-only preflight

Project: `yauqsxggtuxuykcbrtzf`.

Observed during final convergence:

- canonical Students: 116
- current `student_classes`: 70
- homework submissions: 3
- duplicate homework `(homework_id, student_id)` groups: 0
- assessment attempts: 0
- notifications: 1
- production notification own-read policy: `user_id = auth.uid()`
- production notification own-update policy: `user_id = auth.uid()`
- production admin-insert policy binds school-admin authority and recipient relationship to the notification school

No production data, migration, RLS, grants, function, Edge Function or runtime configuration was mutated during this certification pass.

## Exact-head gates

Required on the final PR #302 head after this manifest update:

- Student Core Journey Pilot
- Student One Full Journey
- Student One Legacy Identity Recovery
- Student Provisioning Contract
- Task 3 Student Identity Integrity
- Task 3 Student Identity Concurrency
- Teacher Pilot Task 4
- Deterministic Twin Contract
- Auth Gateway Contract
- Auth & Onboarding Hardening
- Supabase Migration Security Contract
- Task 2 Database Reconstruction Integrity
- TBL-011 Isolated Clean Rebuild
- TBL-012 repository extractor
- TypeScript and Production Build Gate
- CI Production Build Contract
- other automatically triggered repository contracts

Use PASS / FAIL / BLOCKED / NOT APPLICABLE only. Queued/running/stale SHA evidence is not PASS.

## Final merge contract

Merge PR #302 only if:

1. exact current main remains the reconciled base or is re-reconciled
2. PR remains mergeable
3. all required exact-head CI completes successfully
4. migration security and clean reconstruction pass
5. no Task-5-owned P0/P1 remains
6. production preflight remains read-only and materially unchanged
7. merge uses the exact certified head SHA

After merge, verify the new `main` contains the exact Task 5 candidate and close/supersede PR #284. Then Task 6 becomes the next reconciliation/promotion target.

## Safety

This handover does not authorize an out-of-band production migration or data repair. Repository merge and any later production database promotion remain separately observable release actions.
