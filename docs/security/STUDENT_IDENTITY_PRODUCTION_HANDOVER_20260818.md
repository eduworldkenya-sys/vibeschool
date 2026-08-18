# Student Identity Production Handover — 2026-08-18

## Decision

**Student = 1 is certified for the academic identity boundary covered by PR #240 and this production-parity closure.**

`public.students.id` is the durable learner identity for the eight academic/KCSE evidence tables in scope. `auth.uid()` / `profiles.id` remains account identity and is resolved to the canonical learner through `public.current_student_id()`.

## GitHub lineage

- PR #240: `fix: canonicalize student academic identity`
- Certified PR head: `ec6a9b310cb3bbceb5c0a89043dfb8625a1aa08b`
- Merge commit: `c249f195745a3ecea4bbb36fa97cb1fb1039f15e`
- Original canonical migration: `20260818132500_canonical_student_academic_identity.sql`
- Production completion migration: `20260818140000_canonical_student_rpc_identity_completion.sql`

## Original production defect

One profile/account UUID mapped uniquely to one active canonical learner:

- profile/account: `0bfe3177-6fdb-4e02-8fb1-2802f0b6116e`
- canonical learner: `4e3fa6ea-a023-444e-8c0f-98b7d62417c3`

There were **29** wrong-domain academic rows:

- 16 `student_mistake_notebook`
- 10 `student_practice_attempts`
- 2 `student_kcse_retest_schedule`
- 1 `student_exam_readiness_state`

No ambiguous mapping or collision was found for this repair.

## Root cause

PR #240 itself was correct and fully certified, but production promotion was partial. The row rewrite, foreign-key and RLS portion reached production while the asserted runtime RPC/function rewrites did not. The management-tool promotion also recorded four migrations under generated 11:54–11:55 UTC versions instead of the repository's 13:24–13:25 versions. That created two related defects:

1. live runtime functions could continue interpreting profile/account IDs as academic student IDs;
2. repository migration history and production migration history no longer had identical version identities.

The incident was therefore treated as one repository↔production parity defect, not as a new identity design.

## Production repair

Before mutation, production was checked against the exact expected legacy definitions. **34 certified legacy identity fragments across 24 runtime functions** were present. Because every asserted predecessor fragment matched, the repair could fail closed rather than guess.

The production completion changed only those asserted fragments, including KCSE mistake, mock, mastery, revision, readiness, adaptive-practice, Twin-memory, learner practice, parent brief and teacher brief paths. Profile/account-key academic predicates were replaced by canonical learner predicates or `public.current_student_id()` as appropriate.

The migration reasserts the resolver privilege boundary:

- `SECURITY DEFINER`
- pinned `search_path = public, pg_temp`
- no execute privilege for `anon` or `PUBLIC`
- execute for `authenticated` and `service_role`

## Data and structural postconditions

All eight tables in the canonical academic boundary have zero rows whose `student_id` fails to resolve to `public.students.id`:

1. `student_exam_readiness_state`
2. `student_mistake_notebook`
3. `student_practice_attempts`
4. `student_revision_plan_items`
5. `student_kcse_subject_confidence`
6. `student_kcse_error_classifications`
7. `student_kcse_retest_schedule`
8. `student_kcse_mock_sessions`

Each table has exactly one `student_id` foreign key to `public.students(id)` with `ON DELETE CASCADE`, and RLS is enabled on all eight.

The original 29-row learner now resolves as:

- readiness: profile-keyed 0 / canonical 1
- mistakes: profile-keyed 0 / canonical 16
- practice attempts: profile-keyed 0 / canonical 10
- retests: profile-keyed 0 / canonical 2

## Runtime postconditions

- legacy asserted identity fragments remaining: **0**
- runtime functions covered: **24**
- identity fragments certified: **34**
- authenticated resolver check for the affected account returns canonical learner `4e3fa6ea-a023-444e-8c0f-98b7d62417c3`
- direct authenticated SELECT on `student_practice_attempts` remains denied at the grant layer; this is retained intentionally as defense in depth and was not weakened to make an RLS test pass

## Migration ledger parity

Production migration history was guarded and realigned to repository timestamps without replaying already-applied schema mutations:

- `20260818132450` — `restore_adaptive_revision_plan_wrapper_parity`
- `20260818132451` — `restore_adaptive_revision_context_parity`
- `20260818132452` — `restore_kcse_candidate_os_parity`
- `20260818132500` — `canonical_student_academic_identity`
- `20260818140000` — `canonical_student_rpc_identity_completion`

The `20260818140000` repository migration is deliberately replay-safe. On a clean rebuild, `20260818132500` has already canonicalized the functions, so the completion migration accepts the exact canonical fragments as a no-op. On a partially promoted environment it replaces the exact legacy fragments. Any third/unrecognized function state fails closed.

## CI contract

The Student Identity Contract now watches both canonical migrations, the production handover and its workflow. It asserts:

- all eight canonical academic tables remain in contract;
- the original migration preserves FKs, resolver restrictions, fail-closed preflight/collision/function/RLS postconditions;
- the completion migration preserves all 24 runtime signatures and 34 certified identity fragments;
- runtime completion accepts only the exact legacy or exact canonical state;
- completion re-certifies canonical rows and FKs.

## Operational rule

For durable learner academic/evidence state, use `public.students.id`. Do not write `auth.uid()` or `profiles.id` directly into an academic `student_id` column. Resolve the signed-in account through `public.current_student_id()` at an authenticated boundary, or pass an already-authorized canonical learner ID for staff/parent workflows.

Future migrations that touch these tables or the 24 certified functions must keep the Student Identity Contract green.

## Deployment note

No Vercel action was required or intentionally triggered for this database-focused incident. Production Supabase and repository migration history were handled directly.
