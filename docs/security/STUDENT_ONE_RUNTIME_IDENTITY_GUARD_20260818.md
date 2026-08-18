# Student = 1 — Runtime Identity Guard Handover — 2026-08-18

## Purpose

Close the remaining resolver/instrumentation weakness after structural semantic identity closure.

The canonical invariant is now stronger than a naming rule:

- `auth.users.id` / `profiles.id` = account identity.
- `public.students.id` = durable learner identity.
- one claimed active student profile may resolve to at most one active `students` row.
- a resolver must fail closed on ambiguity rather than silently choose the first row.
- operational Student=1 health must be measurable in production.

## Production postflight before this migration

The semantic-closure production postflight was clean:

- 31 content learning events retained.
- 15 have canonical learner IDs.
- 16 remain account-only with provenance preserved.
- 30 reading sessions retained.
- 13 have canonical learner IDs.
- 17 remain account-only.
- wrong public `student_id` FK domains: 0.
- content learner orphans: 0.
- reading-session learner orphans: 0.
- topic-note learner orphans: 0.

The account/learner population scan showed:

- 116 active learner rows.
- 1 claimed active learner (`profile_id` present).
- 115 legitimate roster/unclaimed active learners.
- 0 duplicate active profile→learner mappings.
- 0 active learner/profile role mismatches.
- 9 active student-role profiles currently have no canonical learner row.

Those 9 accounts are not auto-linked. There is no safe evidence that proves which existing roster learner, if any, each account represents. Existing provisioning/reconciliation policy requires proof rather than identity guessing.

## Defect found

`current_student_id()` previously resolved by:

`WHERE profile_id = auth.uid() AND deleted_at IS NULL ORDER BY ... LIMIT 1`

Today production has no duplicate active mapping, but that implementation would silently select a learner if a duplicate mapping were ever introduced. This is unacceptable for the root identity resolver because downstream Twin, adaptive learning, KCSE, submissions, results, teacher visibility and parent visibility trust its output.

## Remediation

Migration: `supabase/migrations/20260818190000_student_one_runtime_identity_guard.sql`

It adds:

1. `students_one_active_profile_uidx` — a partial unique index preventing more than one active learner row for the same non-null profile.
2. A hardened `current_student_id()` — returns null when no canonical learner exists and raises `ambiguous_learner_identity` if ambiguity is ever detected.
3. `student_identity_health_runs` — service-only operational telemetry for Student=1 health.
4. `run_student_identity_health_check()` — checks wrong/missing `student_id` FK contracts, duplicate active profile mappings, role mismatches, active student profiles without learners, and claimed/unclaimed learner counts.
5. Migration postconditions that fail on duplicate active mappings or profile-role mismatch.

## Runtime/adult visibility audit

Production function definitions were re-inspected after semantic closure.

Canonical learner runtime is present in:

- Twin brain/tutor context.
- adaptive learning path.
- KCSE Candidate OS.
- teacher sync context.
- teacher personalized path and KCSE brief.
- parent child dashboard and KCSE brief.

The inspected teacher and parent RPCs authorize access through canonical `student_id` relationships (`student_classes`, `teacher_classes`, `parent_student_links`) rather than profile-ID shortcuts. Student-side runtime resolves the authenticated account to canonical learner identity before reading learner state.

## Historical/incomplete accounts

Nine active student-role profiles currently have no canonical learner row. They are an observed legacy/provisioning state, not a reason to guess identity. The correct posture is:

- fail closed for learner runtime until canonical identity exists;
- expose the count in Student=1 health instrumentation;
- retain the existing auth identity reconciliation finding `STUDENT_DOMAIN_MISSING`;
- repair only through deterministic provisioning/claim evidence.

## Certification

Permanent contract:

- `scripts/test-student-one-runtime-identity-guard.mjs`
- `.github/workflows/student-one-runtime-identity-guard.yml`

Promotion requires:

1. dedicated runtime identity contract green;
2. existing Student One semantic/content contracts green;
3. migration security green;
4. TBL-011 clean rebuild green;
5. TBL-012 repository extraction green;
6. Auth/onboarding + Student provisioning green;
7. TypeScript/production build green;
8. production migration apply;
9. production `run_student_identity_health_check()` postflight;
10. exact-current-main reconciliation before merge.

## Deployment rule

No intentional Vercel action is required for this database/runtime identity certification. Keep frontend promotion conserved until the Student=1 programme release gate is complete.
