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
- Parent KCSE brief incorrectly used `receives_alerts` as an authorization predicate. This confuses notification preference with access authority.
- Teacher KCSE brief and personalized path independently implemented teacher/student relationship checks, creating authorization-drift risk.
- `run_student_identity_health_check()` timed out in production while expanding `information_schema`, so identity regression instrumentation was not operationally reliable.

## Remediation

Migration `20260818202000_student_one_full_journey_certification.sql`:

1. Introduces `is_teacher_of_student(uuid)` as the canonical current-class teacher/student relationship predicate.
2. Changes `parent_get_student_kcse_brief(uuid)` to authorize with `is_parent_of_student(uuid)`. `receives_alerts` is now only a notification preference.
3. Makes teacher KCSE and personalized-path RPCs share `is_teacher_of_student(uuid)`.
4. Replaces the expensive `information_schema` identity-health FK scan with a direct `pg_catalog` scan.
5. Keeps identity-health execution service-role only.
6. Fails closed if any public FK column named `student_id` references outside `public.students(id)`.

## Remaining certification sequence

- exact-head dedicated contract
- migration security
- isolated clean rebuild
- repository extraction
- TypeScript/production build
- auth/onboarding/provisioning regression gates
- production migration apply
- production `run_student_identity_health_check()` runtime proof
- production adult relationship and Twin/runtime postflight
- current-main reconciliation
- merge

## Deployment rule

No intentional Vercel action until all above gates are green and the branch is safe to promote.
