# VibeSchool Task 6 — Parent Core Journey Production Certification

## Starting state

- Baseline exact main: `77051a4011d7712a275f76af41efed382f017398`.
- Branch: `cert/parent-core-journey-task6-20260819`.
- PR: `#285`.
- Production Supabase: `yauqsxggtuxuykcbrtzf`.
- Production parent relationships at discovery: 2 link rows, 2 distinct parents, one active learner each, zero duplicate parent/student pairs, zero missing learner/profile targets, zero legacy `parent_students` rows.
- Production has no real multi-child parent fixture yet.
- Production had one currently redeemable parent-role claim code.
- `parent_profiles` had zero rows; it is an optional descriptive extension, not an authority root.
- Parent Command Center R1 application code was merged/deployed previously, but its event/payment-claim migrations were absent from production schema history.

## Canonical identity model

`auth.users.id -> profiles.id -> optional parent_profiles.profile_id -> parent_student_links.parent_id -> parent_student_links.student_id = students.id -> current school/class enrollment`.

Rules:

1. `students.id` is the canonical learner identifier.
2. Parent authority comes only from an active `parent_student_links` relationship (`access_level <> 'none'`).
3. Names, surnames, phone numbers, admission guesses and browser-supplied student IDs never establish family authority.
4. A parent claim code is one-time and role-specific. It proves only the relationship it was issued for.
5. Parent relationship proof does not automatically prove pickup authority or primary-guardian status.
6. `profiles.role` remains a UX/onboarding hint; Twin authority derives Parent role from active family relationships, so linking does not overwrite an existing teacher/student role.

## Production findings

### P0

1. Several legacy Parent RLS policies treated existence of a `parent_student_links` row as authority even after `access_level='none'`. Sparse production fixtures prevented a live-row leak during the rolled-back attack, but the policy contract itself was unsafe.
2. `assessment_gradebook_entries` Parent reads did not require `released_at`, structurally exposing provisional results to an otherwise authorized parent.
3. `/parent/create-child` allowed an ordinary Parent to invoke SECURITY DEFINER `create_child_for_parent` and manufacture a canonical `students` record from only name/DOB. Production confirmed `authenticated` had EXECUTE. The function also fabricated `is_primary=true` and `can_pickup=true`.
4. Parent Learn retained child-scoped result/progress state across a slow or failed sibling switch, creating a stale-child privacy risk.
5. Child-scoped VibeConnect participant membership could outlive family-relationship revocation.
6. Child-scoped `parent_events` remained parent-owned after relationship revocation unless the relationship was rechecked.

### P1

1. Parent claim copy incorrectly stated a claim code could be reused by Parent and Student; the RPC is one-time and parent-role-specific.
2. Claim redemption auto-granted pickup/primary authority and could overwrite an existing teacher profile role to `parent`.
3. Parents could insert authoritative `finance_fee_payments` rather than submitting governed payment evidence.
4. Legacy `exam_results` lacked a Parent publication boundary; locked exam is now the fail-closed pilot boundary.
5. Publication-less `traditional_grades` had a direct Parent read policy.
6. Parent notification destinations included a non-existent `/parent/report-cards` route and a multi-child-ambiguous `/parent/learn?studentId=...` destination.
7. `/parent/connect-child` initially pointed to the communications compatibility route rather than the verified claim flow.

## Repairs

### `20260819021500_parent_core_journey_privacy_closure.sql`

- Reasserts canonical active-family predicate `is_parent_of_student(students.id)`.
- Closes revoked access across attendance, homework/submissions/answers, parent messages, learning resources, finance and badges.
- Requires released gradebook results.
- Requires locked legacy exams for Parent exam-result visibility.
- Removes Parent read of publication-less `traditional_grades`.
- Removes direct Parent authoritative fee-payment insertion.
- Requires active relationship + explicit `can_view_finance` for finance reads.
- Removes Parent read of internal `child_audit_log`.

### `20260819021600_parent_communication_revocation_closure.sql`

- Child-scoped parent events disappear on relationship revocation.
- Adds learner authorization below VibeConnect participant membership.
- Revoked parents cannot read/update learner threads, participants or messages, or send new messages in that learner scope.
- Adds defense-in-depth trigger preventing creation/update of a Parent-created learner thread without an active family relationship.

### `20260819021700_parent_claim_authority_closure.sql`

- Keeps claim redemption bound to `auth.uid()` and parent-role codes.
- Preserves one-time/expiry semantics.
- Reuses/reactivates the same parent/student relationship deterministically instead of creating duplicates.
- No automatic primary-guardian or pickup authority.
- Preserves existing teacher/student account role.
- A fresh school-issued code may reactivate the same revoked relationship, providing new explicit evidence.

### `20260819021800_parent_canonical_student_creation_closure.sql`

- Revokes `create_child_for_parent(text,date,uuid)` from ordinary authenticated users.
- Leaves the legacy recovery function service-role-only.
- `/parent/create-child` now redirects to `/parent/link-child` instead of creating canonical students from parent-entered identity guesses.

### `20260819021900_parent_notification_navigation_closure.sql`

- Normalizes child-scoped event links before storage.
- Dead `/parent/report-cards...` and sibling-ambiguous `/parent/learn?studentId=...` links resolve to the canonical authorized child hub.
- Existing affected event rows are repaired during migration.

### Frontend

- `app/parent/learn/page.tsx`: mobile-first, released-result/published-summary truth, clears all child state before a switch, generation-checks async responses, has no cross-child cache, and fails empty on network error.
- `app/parent/link-child/page.tsx`: truthful one-time claim flow, explicit least-authority copy, expired/already-used/already-linked recovery states, no student-ID entry.
- `app/parent/connect-child/page.tsx`: compatibility redirect to `/parent/link-child`.
- `app/parent/create-child/page.tsx`: compatibility redirect to `/parent/link-child`.

## Permanent regression protection

- `scripts/validate-parent-core-journey.py` asserts revocation, released-results, finance authority, communication revocation, claim least-authority, canonical learner creation denial, deterministic notification navigation and fail-closed child switching.
- `.github/workflows/parent-core-journey-contract.yml` runs the Parent contract on PRs and `main`.
- Existing Migration Security, clean rebuild, repository extraction, Auth Gateway/Auth & Onboarding, Student provisioning/identity and production-build gates remain mandatory.

## Production attacks already executed

- Parent A -> unrelated Parent B child direct backend reads: PASS; zero student, attendance, homework-submission, gradebook and exam-result visibility.
- Revocation simulation: existing relationship set to `access_level='none'` inside a transaction, session changed to the Parent JWT subject, visibility tested, then transaction rolled back. No production family record was persistently modified.
- Production relationship integrity scan: no duplicate link pairs, no missing learner target, no missing profile target.

## Production schema drift to close after exact-head certification

The following already-merged R1 migrations were absent from production at Task 6 start and must precede Task 6 communication/event closures:

- `20260818183000_parent_child_scoped_vibeconnect.sql`
- `20260818184500_parent_event_inbox_and_fee_truth.sql`
- `20260818185000_parent_assessment_learning_events.sql`
- `20260818185100_parent_communication_delivery_closure.sql`

Then promote Task 6 `20260819021500` through `20260819021900` in repository order, verify policies/functions/triggers, rerun direct RLS attacks and check Supabase advisors.

## Certification status

Candidate before final handover refresh: `d323765f08b19ea453aae7230cde34504fcab8b0`; this document update becomes the final candidate head to certify.

Already demonstrated on equivalent earlier Task 6 heads:

- Supabase Migration Security Contract: PASS.
- TBL-012 repository extraction: PASS.
- Student One Full Journey: PASS.
- Student One Legacy Identity Recovery: PASS.
- Cross-parent production RLS attack: PASS.
- Rolled-back revocation attack: PASS.

Final exact-head requirements still mandatory after this documentation commit:

- Parent Core Journey Contract.
- Supabase Migration Security Contract.
- TBL-011 isolated clean rebuild.
- TBL-012 repository extraction.
- TypeScript + production build and CI Production Build Contract.
- Auth Gateway / Auth & Onboarding / Student provisioning and Student identity regressions.
- Exact-current-main reconciliation check.
- Production schema promotion + backend privacy attack.
- Intended final application deployment.
- Authenticated Parent browser E2E including logout/re-login. No reusable Parent password is committed; if no authenticated production test session is available at that final step, credentials are the only permitted human-input blocker.

## Merge rule

Do not merge on rendered pages alone. Do not merge with ambiguous family identity, failing/stale gates, production schema drift that would break the Parent app, or unresolved P0/P1 Parent defects. Once the exact candidate is green, promote the intended database changes, re-run privacy attacks, merge once, let the intended final main deployment complete, run production Parent E2E, and record final evidence.
