# Student = 1 — Semantic Identity Closure Handover — 2026-08-18

## Purpose

Close the remaining mixed-domain `student_id` structures discovered after the Content Learning Identity repair.

The governing invariant is now explicit:

> If a public column is named `student_id`, it represents `public.students.id` and must FK to `public.students(id)`. Account/session/profile telemetry must use `viewer_id`, `account_user_id`, `profile_id`, or another semantically accurate account-domain name.

## Production investigation

After the content-learning boundary was canonicalized, a database-wide FK scan found five remaining `student_id` columns outside the canonical learner domain:

- `student_schools.student_id -> auth.users(id)` — 0 rows; legacy table is locked/read-nothing.
- `student_topic_notes.student_id -> profiles(id)` — 0 rows; true learner-owned revision state.
- `vibelearn_content_saves.student_id -> auth.users(id)` — 0 rows; legacy learner save state, while active runtime uses `vibelearn_saved`.
- `vibelearn_content_views.student_id -> auth.users(id)` — 14 rows; account/viewer telemetry, not durable learner state.
- `vibelearn_searches.student_id -> profiles(id)` — 0 rows; account/profile search telemetry.

The earlier pilot semantic repair had intentionally left views/searches account-keyed, but retained the misleading `student_id` name. This made structural Student=1 certification impossible and allowed future code to mistake account UUIDs for learner UUIDs.

## Revision Workspace runtime defect

Production `student_save_topic_note(...)` used `auth.uid()` while `student_get_revision_workspace(...)` had already been converted to `current_student_id()` for its learner queries. The result was a split-domain path: a learner could save a topic note under the account UUID and the workspace could then look for that note under canonical `students.id`.

The same workspace used canonical `v_student` when counting `vibe_reading_progress.viewer_id`, but `viewer_id` is explicitly profile/account-scoped. That caused reading journey counters to resolve through the wrong identity domain.

## Remediation

Migration: `supabase/migrations/20260818184000_student_one_semantic_identity_closure.sql`

### Canonical learner state

`student_topic_notes`:

- rebinds `student_id` to `public.students(id)`;
- rewrites owner RLS through `students.profile_id = auth.uid()`;
- rewrites `student_save_topic_note(...)` to `current_student_id()`;
- leaves `student_get_revision_workspace(...)` using canonical student identity for notes, plans, practice, mistakes and learner events.

`vibelearn_content_saves`:

- empty legacy table is rebound to `students(id)`;
- PUBLIC owner policies are replaced with explicit authenticated canonical-learner policies;
- teacher read access remains tied to submitted content.

`student_schools`:

- empty legacy table is rebound to `students(id)`;
- its locked/read-nothing posture is preserved; this migration does not reactivate the legacy path.

### Account telemetry

`vibelearn_content_views`:

- preserves all existing account-view rows;
- renames `student_id` to `viewer_id`;
- keeps FK authority on `auth.users(id)` under the truthful name;
- rewrites viewer RLS and `increment_view_count(...)` accordingly.

`vibelearn_searches`:

- renames `student_id` to `viewer_id`;
- keeps its profile/account FK under the truthful name;
- rewrites owner RLS accordingly.

### Mixed-domain Revision Workspace

`student_get_revision_workspace(...)` now carries both:

- `v_student := current_student_id()` for durable learner state;
- `v_account := auth.uid()` for account-owned reading progress.

The `books_started` and `chapters_completed` counters query `vibe_reading_progress.viewer_id = v_account`, while learner notes/practice/mistakes continue using canonical `v_student`.

## Fail-closed certification

The migration fails if any remaining public FK column named `student_id` targets anything other than `public.students(id)`.

Regression contract:

- `scripts/test-student-one-semantic-identity-closure.mjs`
- `.github/workflows/student-one-semantic-identity-closure.yml`

## Promotion gates

Before production application:

1. dedicated semantic identity contract;
2. Supabase Migration Security Contract;
3. TBL-011 isolated clean rebuild;
4. TBL-012 repository extractor;
5. TypeScript + production build;
6. CI production build;
7. Auth/onboarding and Student provisioning contracts;
8. exact-current-main reconciliation.

After production application, re-run the database-wide `student_id` FK scan. Expected result: every public FK column named `student_id` points to `public.students(id)`.

## Remaining full-programme certification

This closes structural/semantic ID-domain ambiguity, but Student=1 is not declared fully pilot-certified until the following are exercised end to end:

- Twin/adaptive/KCSE runtime identity;
- teacher and parent product-page visibility;
- mismatch/orphan/resolver-failure instrumentation;
- Auth → Student → Classroom → Learning → Submission → Result → Adult/Twin journey.

No intentional Vercel action is required for this database/runtime identity slice.
