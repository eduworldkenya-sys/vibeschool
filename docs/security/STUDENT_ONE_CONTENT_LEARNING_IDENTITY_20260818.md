# Student = 1 — Content Learning Identity Handover — 2026-08-18

## Mission

Close the final known identity-domain island in the reading/content-intelligence path without corrupting historical account-scoped reading evidence.

Canonical rule:

- `auth.users.id` / `profiles.id` = account/session identity.
- `public.students.id` = durable learner identity.
- Reading is not exclusively a student activity, so `vibe_reading_sessions.viewer_id` remains account-scoped.
- Learner analytics and adaptive/content intelligence must use canonical `students.id` only.

## Production evidence before remediation

`content_learning_events`:

- 31 rows total.
- 31/31 `student_id` values are auth-user/account UUIDs.
- 0/31 directly resolve to `public.students.id`.
- 15/31 deterministically resolve through active `students.profile_id`.
- 16/31 do not currently have a provable active canonical learner mapping.

`vibe_reading_sessions`:

- 30 rows total.
- 30/30 `viewer_id` values are account/profile UUIDs.
- 0/30 directly resolve to `public.students.id`.
- 13/30 deterministically resolve through active `students.profile_id`.
- 17/30 are account-only/unmapped to an active learner.

There are zero active duplicate `students.profile_id` mappings, so deterministic active learner backfill is unambiguous where a mapping exists.

## Root cause

The original ENGINE-001 migration defined `content_learning_events.student_id` as an FK to `auth.users(id)`, and its RLS compared it directly to `auth.uid()`.

Two producers preserved this mistake:

1. `record_content_learning_event(...)` wrote `auth.uid()` into `student_id`.
2. `project_reading_session_learning_events()` copied `vibe_reading_sessions.viewer_id` into `content_learning_events.student_id`.

`run_content_intelligence_cycle()` then consumed those events as learning-effectiveness evidence. This allowed account-domain activity to masquerade as canonical learner evidence.

## Architectural decision

Do not convert `vibe_reading_sessions.viewer_id` into learner identity. It represents the authenticated reader and can legitimately describe a teacher or other entitled reader.

Instead, separate the domains explicitly:

### Reading session

- `viewer_id` — account/profile identity and entitlement/session ownership.
- `student_id` — nullable canonical learner identity, populated only when the authenticated viewer resolves to an active student.

### Content learning event

- `account_user_id` — account provenance for historical ownership/audit.
- `student_id` — nullable canonical `public.students.id` learner identity.

A content event without canonical `student_id` is historical/account evidence only and must not feed learner intelligence.

## Migration

`supabase/migrations/20260818181500_student_one_content_learning_identity.sql`

The migration:

1. Adds nullable canonical `student_id` to `vibe_reading_sessions` and backfills only deterministic active learner mappings.
2. Adds `account_user_id` to `content_learning_events` and preserves every historical auth UUID there before changing semantics.
3. Rebinds `content_learning_events.student_id` to `public.students(id)`.
4. Backfills canonical learner IDs only when mapping is deterministic; unmapped historical events retain `student_id = null` with account provenance preserved.
5. Removes authenticated direct INSERT authority on `content_learning_events`.
6. Replaces the event RPC with a server-authoritative `current_student_id()` resolver that fails closed when canonical learner identity does not exist.
7. Keeps reading-session account ownership while capturing canonical learner identity separately.
8. Changes the reading-session projection trigger to emit learner evidence only when `new.student_id` is present.
9. Changes the Content Intelligence cycle to consume only events with non-null canonical `student_id`.
10. Adds fail-closed postconditions for canonical FK integrity and direct-write authority.

## Historical data policy

No historical UUID is guessed.

All old account identifiers are retained in `account_user_id`. Only deterministic active mappings are promoted to canonical learner identity. The remaining unmapped historical events stay queryable as account provenance but are excluded from learner-effectiveness intelligence.

This deliberately prefers incomplete learner history over false learner history.

## Regression certification

- `scripts/test-student-one-content-learning-identity.mjs`
- `.github/workflows/student-one-content-learning-identity.yml`

The contract rejects reintroduction of account UUIDs into canonical learner fields and asserts the learner-only Content Intelligence filter.

## Promotion gates

Before production apply / merge:

1. Dedicated Student One Content Learning Identity contract.
2. Supabase Migration Security Contract.
3. TBL-011 isolated clean rebuild.
4. TBL-012 repository extractor.
5. TypeScript + production build.
6. Auth/onboarding and Student provisioning contracts.
7. Exact-current-main reconciliation.
8. Production postflight verifying FK domains, mapped/unmapped preservation, RLS/grants, function definitions and learner-only intelligence.

## Remaining Student = 1 programme

After this boundary is production-certified, re-audit:

- Twin/adaptive/KCSE runtime RPC identity.
- Teacher and parent full product-page visibility journeys.
- mismatch/orphan/resolver-failure instrumentation.
- Auth → Student → Classroom → Learning → Submission → Result → Adult/Twin E2E certification.

Only after those gates pass should Student = 1 be marked fully pilot-certified.

## Operational rule

No intentional Vercel deployment for this isolated database/identity work. Application promotion remains held until the complete certification boundary is green.
