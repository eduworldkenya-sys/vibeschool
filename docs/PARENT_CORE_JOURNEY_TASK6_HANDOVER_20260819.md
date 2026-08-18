# VibeSchool Task 6 — Parent Core Journey Production Certification

## Starting state

- Baseline main: `77051a4011d7712a275f76af41efed382f017398`.
- Certification branch: `cert/parent-core-journey-task6-20260819`.
- Production Supabase project: `yauqsxggtuxuykcbrtzf`.
- Production parent relationships: 2 link rows, 2 distinct parents, one active child per parent, zero duplicate links, zero links to missing students, zero legacy `parent_students` rows.
- Production `parent_profiles`: 0 rows. The authoritative parent identity for access is `auth.users.id -> profiles.id`; `parent_profiles(profile_id)` is an optional parent-domain extension created/upserted by Parent Profile.
- Canonical learner identity is `students.id`.
- Relationship authority is `parent_student_links(parent_id = profiles.id/auth.uid(), student_id = students.id)`. Active access requires `coalesce(access_level,'full') <> 'none'`.
- Merged Parent Command Center R1 exists in repository history, but its event/payment-claim migrations were absent from production at Task 6 start. Production therefore had VibeConnect core tables but no `parent_events` or `finance_parent_payment_claims`.

## Explicit identity model

`auth.users.id` -> `profiles.id` -> optional `parent_profiles.profile_id` -> verified/administratively-created `parent_student_links.parent_id` -> canonical `parent_student_links.student_id = students.id` -> school/class through current learner enrollment/class context.

`parent_profiles` is descriptive parent profile data, not an authorization root. No surname/name/phone similarity creates a family relationship. `redeem_parent_claim` and school/admin authority are the supported relationship-establishment paths. Browser-supplied learner IDs are always constrained by RLS/relationship predicates.

## Findings

### P0/P1 privacy and integrity

1. **Revocation semantics had drifted across legacy RLS policies.** Several Parent policies treated existence of any `parent_student_links` row as authority even if `access_level = 'none'`. A sparse production fixture meant the rolled-back revocation attack returned zero matching academic rows today, but the policy itself was unsafe and would authorize matching data when present.
2. **Assessment gradebook Parent read lacked `released_at` gating.** Draft/provisional gradebook rows were structurally visible to an otherwise authorized parent.
3. **Legacy `exam_results` had no Parent publication boundary.** Task 6 uses locked exams as the fail-closed pilot release boundary because the legacy table has no `released_at` column.
4. **Legacy `traditional_grades` had no publication state.** Direct Parent read is removed; Parent surfaces use released gradebook/report-card truth instead.
5. **Authoritative fee ledger still accepted Parent inserts in production.** This bypassed the R1 payment-claim truth boundary.
6. **Parent Learn child switching could preserve result/progress state from the previous child during slow/failed loading.** This violated the Task 6 no-stale-child-data invariant.
7. **Child-scoped VibeConnect membership survived relationship revocation.** Existing participant membership alone was insufficient as a family authorization boundary.
8. **Child-scoped historical `parent_events` would remain readable after relationship revocation under the original R1 parent-owned policy.** Task 6 adds active-child authorization to child events.

### Production attacks executed safely

- Parent A -> Parent B child: direct RLS query returned zero student, attendance, homework-submission, gradebook and exam-result rows.
- Revocation simulation: an existing Parent A relationship was changed to `access_level='none'` inside a transaction, the session was switched to the `authenticated` role with Parent A JWT subject, visibility was measured, then the transaction was rolled back. No production relationship was persistently modified.
- Production has no real multi-child parent fixture yet; production multi-child switching is therefore not applicable to the current dataset. The UI code path is designed for multiple children and clears all child-scoped state before switching.

## Repairs

### Database / RLS

`20260819021500_parent_core_journey_privacy_closure.sql`

- Reasserts `is_parent_of_student(students.id)` as the active relationship predicate.
- Closes revoked access to attendance, homework, submissions, parent messages, learning resources, finance, badges and homework answers.
- Requires `assessment_gradebook_entries.released_at is not null` for Parent reads.
- Requires legacy `exam_results` to belong to a locked exam for Parent reads.
- Removes Parent read of publication-less `traditional_grades`.
- Removes Parent insert into authoritative `finance_fee_payments`.
- Requires active link + `can_view_finance` for finance reads.
- Removes Parent access to internal `child_audit_log`.

`20260819021600_parent_communication_revocation_closure.sql`

- Child-scoped parent events disappear immediately when a learner relationship is revoked.
- Adds child-scope authorization below VibeConnect participant membership.
- Prevents a revoked parent from viewing/updating child threads, viewing participants, reading messages or sending new messages in that learner context.
- Adds a database trigger that rejects creation/update of a parent-created child thread unless the relationship is active.

### Frontend

`app/parent/learn/page.tsx`

- Rebuilt as a smaller mobile-first family learning surface using released assessment-gradebook truth and published parent-learning summaries.
- Every child switch increments a request generation, clears all child-scoped state before changing context and ignores stale responses.
- No cross-child client cache is used.
- Network failures remain empty/fail-closed instead of reusing another child's data.
- Results are explicitly limited to released rows.
- Legitimate empty states are explained for homework, progress and results.

## Production schema promotion gap

The following already-merged Parent Command Center R1 migrations were not present in production history at Task 6 start and must be promoted before final Parent production E2E:

- `20260818183000_parent_child_scoped_vibeconnect.sql`
- `20260818184500_parent_event_inbox_and_fee_truth.sql`
- `20260818185000_parent_assessment_learning_events.sql`
- `20260818185100_parent_communication_delivery_closure.sql`

The two Task 6 migrations intentionally run after these in clean repository order.

## Certification status

Candidate head at this handover update: `103434d622e5d1f9ab9df15b3bda56b05211da68`.

- Cross-parent production backend attack: PASS.
- Rolled-back revocation attack safety: PASS (no persistent data mutation).
- Production data integrity scan for existing parent links: PASS for missing learner/profile target and duplicate-link checks.
- Mobile child-state fail-closed implementation: implemented; build/CI pending.
- Supabase Migration Security Contract: pending on current head.
- TBL-011 clean rebuild: pending on current head.
- TBL-012 repository extraction: pending on current head.
- TypeScript + production build: pending on current head.
- Auth & Onboarding / Student identity regression gates: pending on current head.
- Production Parent R1 schema promotion: pending exact-head certification.
- Production Parent browser E2E: pending final intended deployment and an available authenticated parent session.
- Merge: withheld until exact-current-main gates are green.

## Merge rule

Do not merge while any P0/P1 Parent privacy/journey defect remains, while exact-current-main gates are stale/failing, or before the production schema promotion plan is proven safe. After merge, perform one intended final deployment, production Parent E2E, unauthorized-child test, and record the final production commit/schema evidence here.
