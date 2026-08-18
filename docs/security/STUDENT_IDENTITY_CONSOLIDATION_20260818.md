# Student Identity Consolidation — 2026-08-18

## Mission

Make `public.students.id` the single durable learner identity for academic evidence and learner-state records. Authentication identity (`auth.uid()` / `profiles.id`) remains an account identity only and may be bridged through `students.profile_id`.

This work supersedes the mixed-domain conclusion recorded by `20260818013000_pilot_identity_domain_semantic_repair.sql`. That migration correctly identified the existing domains but preserved them as an authorization contract. The current audit proved that preservation fragments one learner across incompatible UUID namespaces.

## Production evidence before repair

Supabase project: `yauqsxggtuxuykcbrtzf`.

A read-only production inventory found exactly one affected profile identity that maps uniquely to one active canonical learner:

- stored profile/auth UUID: `0bfe3177-6fdb-4e02-8fb1-2802f0b6116e`
- canonical `students.id`: `4e3fa6ea-a023-444e-8c0f-98b7d62417c3`
- active mappings for that profile: 1

Wrong-domain rows:

| Table | Rows |
|---|---:|
| `student_mistake_notebook` | 16 |
| `student_practice_attempts` | 10 |
| `student_kcse_retest_schedule` | 2 |
| `student_exam_readiness_state` | 1 |
| **Total** | **29** |

The earlier 27-row estimate omitted the two retest rows and is superseded by this inventory.

No affected production row is ambiguous. No affected table currently contains a competing canonical row for this learner.

## Root cause

VibeSchool evolved two meanings for a column named `student_id`:

1. canonical learner identity: `public.students.id`;
2. account/profile identity: `auth.users.id` / `public.profiles.id`.

Newer learning-event and Twin-state code migrated to the first model, while KCSE, mistake, practice, revision and readiness code retained the second. Several later migrations introduced compatibility predicates such as `student_id in (canonical_student_id, profile_id)`, which kept the split alive instead of removing it.

This is an identity-contract defect, not merely naming debt.

## Binding invariant

After this migration:

- `student_id` on durable learner academic/evidence tables means `public.students.id`.
- `auth.uid()` identifies the signed-in account, never the learner record.
- `public.current_student_id()` is the bounded account → learner resolver used by learner RLS.
- RLS must compare academic `student_id` to the canonical resolver, not directly to `auth.uid()`.
- Academic RPCs may retain both account and learner variables when necessary, but writes/reads of canonical academic tables use the learner UUID.
- Account/viewer telemetry may remain profile keyed only when that is genuinely the entity being measured; such fields should use names like `profile_id`, `user_id`, or `viewer_id` rather than imply canonical student identity.

## Tables canonicalized

- `student_exam_readiness_state`
- `student_mistake_notebook`
- `student_practice_attempts`
- `student_revision_plan_items`
- `student_kcse_subject_confidence`
- `student_kcse_error_classifications`
- `student_kcse_retest_schedule`
- `student_kcse_mock_sessions`

Every listed `student_id` receives an FK to `public.students(id)`.

`student_kcse_mock_answers` remains session keyed; its learner RLS follows the canonical owner of the parent mock session.

## Runtime repair

The forward migration patches the active RPC definitions that still read or write the affected tables using profile/auth IDs. Each patch is exact and asserted: if an expected historical fragment is missing, the migration aborts rather than silently producing a partial repair.

The production version of `student_schedule_forgetting_revision()` already delegates to `student_generate_adaptive_revision_plan()`, so it requires no direct identity patch; the canonical planner repair covers it transitively.

## Safety

The migration is intentionally fail-closed.

Before changing data it rejects:

- an affected `student_id` that is neither already canonical nor uniquely resolvable through one active `students.profile_id`;
- a mapping that would collide with an existing unique academic row.

The production UUIDs above are evidence only and are **not hard-coded** in executable SQL.

No Vercel action is part of this work. Repository changes are consolidated into one branch commit before PR certification.

## Certification gates

Before production promotion:

1. Migration/identity contract static test passes.
2. Exact PR head is reviewed.
3. Repository CI required for migration/build/security changes is green.
4. Production preflight still reports the same unambiguous mapping or another safely resolvable state.

After production promotion:

1. All affected rows resolve to an existing `students.id`.
2. All eight affected tables have an FK from `student_id` to `public.students(id)`.
3. Affected RLS policies contain no direct `auth.uid()` ownership comparison.
4. Runtime RPCs contain no legacy dual-domain predicates for these academic tables.
5. The 29 pre-existing rows are preserved under the canonical learner UUID.
6. Supabase security and performance advisors are reviewed.

## Follow-on identity cleanup

This P0 repair deliberately does not relabel account-scoped telemetry in the same transaction. A later P1 should inventory columns such as historical `vibelearn_content_views.student_id` / `vibelearn_searches.student_id` and rename them to account-semantic names where appropriate, while preserving their data meaning.

Likewise, `student_profiles`, `learner_profiles`, legacy Twin `user_id` surfaces, and the `students.class_id` compatibility cache should be reconciled as separate authority-cleanup units after the canonical academic spine is certified.
