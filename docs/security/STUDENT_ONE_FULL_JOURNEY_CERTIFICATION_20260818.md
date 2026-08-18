# Student = 1 Full Journey Certification — 2026-08-18

## Mission
Prove one canonical learner identity survives the full product journey after the content-learning and semantic identity closures merged in PR #253.

Canonical rule:

`auth.users.id -> profiles.id -> students.id`

Durable learner state, evidence, Twin/adaptive/KCSE records, submissions/results and adult visibility resolve to `students.id`. Account/session telemetry stays explicitly account-scoped and must not masquerade as `student_id`.

## Production findings before this slice

- Global public FK scan: zero `student_id` foreign keys point outside `public.students(id)`.
- Twin/adaptive/KCSE durable tables inspected remain canonical.
- `student_refresh_twin_memory()` correctly resolves learner identity through `students.profile_id` and writes memory claims with canonical `students.id`; reading-session observation remains intentionally account-scoped through `viewer_id=auth.uid()`.
- Parent classroom brief uses `parent_student_links.student_id` and canonical learner-owned attendance/homework/summaries/messages.
- Parent KCSE brief incorrectly used `receives_alerts` as an authorization predicate. This confused notification preference with access authority.
- Teacher KCSE brief and personalized path independently implemented teacher/student relationship checks, creating authorization-drift risk.
- `run_student_identity_health_check()` timed out in production while expanding `information_schema`, so identity regression instrumentation was not operationally reliable.

## Remediation

Migration `20260818202000_student_one_full_journey_certification.sql`:

1. Introduces `is_teacher_of_student(uuid)` as the canonical current-class teacher/student relationship predicate.
2. Changes `parent_get_student_kcse_brief(uuid)` to authorize with `is_parent_of_student(uuid)`. `receives_alerts` is now only a notification preference.
3. Makes teacher KCSE and personalized-path RPCs share `is_teacher_of_student(uuid)`.
4. Replaces the expensive metadata-view identity-health FK scan with direct `pg_catalog` inspection.
5. Keeps identity-health execution service-role only.
6. Fails closed if any public FK column named `student_id` references outside `public.students(id)`.

## Exact-head repository certification

Certified head before production apply: `c5d1b2460e5df80f9d7469f5f7d852fd0619ac28`.

All eight gates passed:

- Student One Full Journey
- Supabase Migration Security Contract
- Student Provisioning Contract
- CI Production Build Contract
- TBL-012 repository extractor
- TBL-011 isolated clean rebuild
- Auth & Onboarding Hardening
- TypeScript and Production Build Gate

The first clean-rebuild attempt exposed a false-positive self-check: the function-definition assertion matched the word `information_schema` in explanatory prose. The assertion was corrected to reject an actual `information_schema.` relation reference. The fresh blank rebuild then replayed the complete repository migration chain successfully.

## Production postflight

Migration `student_one_full_journey_certification` applied successfully to production Supabase.

`run_student_identity_health_check()` now completes successfully rather than timing out. Production run `aab4cca7-9916-4ede-9bfb-d30c55c37f1a` returned:

- status: `attention`
- wrong student FK domains: `0`
- missing student FK constraints: `0`
- duplicate active profile mappings: `0`
- active profile role mismatches: `0`
- active student profiles without learner: `9`
- claimed active learners: `1`
- unclaimed active learners: `115`

The `attention` state is not canonical-identity corruption. The nine unmatched student-role profiles are auth-backed legacy accounts created between 2026-06-05 and 2026-06-22, before atomic learner provisioning. None has a profile school, student school membership or deterministic canonical learner target. They remain intentionally unlinked under the no-guess policy. The 115 unclaimed learners are legitimate roster learners awaiting account claims.

Adult relationship postflight:

- parent links pointing to missing students: `0`
- current student-class rows pointing to missing students: `0`
- teacher-class rows pointing to missing teacher profiles: `0`
- parent KCSE authority uses `is_parent_of_student(p_student_id)` and no longer references `receives_alerts`
- teacher KCSE and personalized-path authority use `is_teacher_of_student(p_student_id)`
- identity-health RPC is executable only by `service_role`
- adult learner-view RPCs are executable only by authenticated/service-role actors and enforce relationship authority internally

Twin/adaptive/KCSE postflight:

The 17 inspected durable learner tables all retain `student_id -> public.students(id)`, including adaptive sessions, generated practice, KCSE error/mock/retest/confidence, learning events/recommendations/mastery/practice/revision, and Twin adaptation/calibration/intervention/exposure/memory/state snapshots.

## Certification verdict

The canonical Student = 1 identity chain is certified across:

`Auth -> Profile -> Student -> Classroom -> Learning/Reading -> Submission/Result -> VibeLearn -> Twin/Adaptive/KCSE -> Parent/Teacher visibility -> Identity health instrumentation`

Historical incomplete accounts remain observable but are never guessed into learner identity. New learner-account attachment remains governed by the atomic provisioning/claim path.

## Deployment rule

No intentional Vercel action was required for this database/authorization certification slice.
