# Student = 1 Legacy Identity Recovery Closure — 2026-08-18

## Problem
Nine active legacy student-role profiles predate atomic learner provisioning and have no canonical `students.id`. Production evidence shows no school binding, no school membership and no deterministic roster target. Duplicate legacy display names make name-based linking unsafe.

## Decision
Do not fabricate learner rows and do not guess-link roster learners. Treat these accounts as governed recovery states while preserving the accounts and their account-scoped history.

## Closure
Migration `20260818205000_student_one_legacy_identity_recovery.sql`:

1. Adds service-only `student_identity_recovery_cases`.
2. Deterministically records pre-atomic student accounts that lack every school/learner binding.
3. Makes `get_my_onboarding_state()` require a canonical learner before returning student `ready`.
4. Routes unresolved student accounts to `/student/claim`.
5. Automatically resolves the recovery case when a canonical `students.profile_id` attachment is created.
6. Makes Student=1 health distinguish governed quarantine from unquarantined identity corruption.
7. Keeps the health gate fail-closed for wrong FKs, missing FKs, duplicate mappings, role mismatches or any missing learner account outside governed recovery.

## Safety
- No `students.profile_id` is guessed.
- No new `students` row is fabricated for a legacy account.
- No name-only matching is accepted.
- The recovery ledger is service-role only.
- Existing account-scoped history remains untouched.
- Canonical recovery uses the existing `/student/claim` and atomic provisioning path.

## Release gate
Before production apply and merge: dedicated recovery contract, migration security, Student provisioning, Auth/Onboarding, TBL-011 clean rebuild, TBL-012 extractor, CI production build and TypeScript/production build must pass on the exact branch head.

After production apply: `run_student_identity_health_check()` must return `healthy`, with zero unquarantined active student profiles without learners and the nine historical profiles represented as governed recovery cases until individually claimed.

No intentional Vercel action is required for this database/onboarding-authority closure.
