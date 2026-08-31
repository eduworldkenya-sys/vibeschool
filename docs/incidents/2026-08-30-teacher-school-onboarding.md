# Teacher-school onboarding authorization incident

- Incident: `INC-2026-08-30-TEACHER-SCHOOL-ONBOARDING`
- State: `REPAIR CANDIDATE`
- Environment: production evidence + repository `a77217bf6fc89ce9b0fa7ebc2c5d4109a7ad5578`
- Opened: 2026-08-30 UTC
- Severity: P0 security/data integrity and teacher activation
- Personas: authenticated active teachers, school administrators, HQ identity reviewers
- Owner: VibeSchool platform/security

## Expected and actual behavior

An authenticated teacher should be able to identify a school, continue in a restricted workspace while employment is reviewed, configure secondary classes, and receive governed school access only after approval.

Production functions instead inserted `school_members`, updated teacher/profile school fields and inserted `school_levels` immediately after a teacher selected a canonical school. Directory schools without a reviewed canonical match raised `school_identity_review_required`. The class page omitted Forms 1–4 and Grades 10–12, while canonical journey state treated a class as a hard access requirement.

## Current evidence

- Production contains 28,834 directory schools, 37 non-deleted canonical schools and 28,832 pending identity candidates as observed on 2026-08-30 UTC.
- Production definitions of `connect_teacher_to_school` and `connect_teacher_to_directory_school` directly insert `school_members` and `school_levels`.
- `lib/school.ts` contained a client-side membership self-heal from legacy profile fields.
- `get_my_auth_journey_state` returned `needs_class` until a `teacher_classes` row existed.
- The teacher class onboarding page listed only PP1–Grade 9.

## Root cause and blast radius

Root-cause confidence: high. School selection, school-identity reconciliation and membership authorization were combined into one operation. Journey guards then used that unauthorized membership as the authority source and also confused optional class setup with access admission.

Affected contracts include school membership authorization, tenant isolation, canonical school classification, directory reconciliation, teacher navigation, class onboarding, notifications and HQ operations. Any active teacher could potentially establish a school-scoped teacher membership by selecting a canonical school.

## Containment and repair candidate

The candidate migration introduces an RLS-protected teacher-school claim ledger, reviewer-only approval, reference codes, review states, notifications and a provisional class store. Legacy connection RPCs delegate to claim submission and cannot mint membership. School levels remain operator-owned. The journey state admits unverified teachers only to a restricted provisional route; a class is optional for verified Teacher OS access. Provisional classes are promoted after an approved claim.

UI changes add all 47 counties, explicit location consent, mixed level selection, Forms 1–4 and Grades 10–12, secondary subjects, progress/back/help/sign-out controls, actionable errors, redirect preservation and the HQ review queue.

## Recovery, regression and closure

- Rollback/recovery: revoke the new RPC grants or restore the prior journey destination while retaining the claim ledger; do not restore direct membership creation.
- Regression: `scripts/teacher-onboarding-contract-test.mjs` and `supabase/tests/governed_teacher_school_onboarding_contract.sql`.
- Positive control: approved reviewer action creates membership and promotes provisional classes; submission does not.
- Monitoring: HQ pending-claim queue, claim age, status notifications and reference-code support path.
- Closure requires exact-head CI, independent security assurance, exact merge, migration application under owner-gated production authority, and live verification of Gerald's journey without exposing school data before approval.
