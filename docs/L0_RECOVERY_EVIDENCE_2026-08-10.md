# L0 Recovery Evidence — 2026-08-10

**Status:** L0 OPEN / RED  
**Production project:** `yauqsxggtuxuykcbrtzf`  
**Purpose:** Evidence record for migration reconciliation and HQ/workforce consolidation.  
**Safety:** Read-only production inspection only. No production schema/data/ledger writes were performed as part of this evidence capture.

## 1. Migration ledger

Current production query:

```text
select version, name from supabase_migrations.schema_migrations order by version limit 5;
```

Current first ledger rows:

```text
20260520000000 | timetable_foundation_baseline
20260521083057 | report_schedules
20260521083115 | report_comparisons
20260521204108 | funhub_schema
20260523       | class_groups
```

The production ledger currently contains **552 rows**.

The repository reconciliation artifact records `20260520000000` as a **live-only `SYNTHETIC_BASELINE`**. The current repository/live reconciliation must still be regenerated from the current branch and current 552-row ledger before any ledger alignment decision.

Earlier 546/339/198/348/141 reconciliation numbers are stale and must not be used as current truth.

## 2. TBL-011 actual failure

The latest referenced clean-rebuild run was GitHub Actions run `31354208333`, job `93350674313`.

The workflow successfully:

- checked out the repository;
- counted **339 migration files** at that commit;
- passed static TBL-011 validation;
- started an isolated local Supabase instance.

The database rebuild then failed on the first migration:

```text
Applying migration 20260521083057_report_schedules.sql...
ERROR: relation "schools" does not exist (SQLSTATE 42P01)
```

The failing migration creates `report_schedules` with foreign keys to `schools(id)` and `profiles(id)`.

Therefore the present blocker is a missing pre-ledger foundation in the repository's reproducible rebuild path.

## 3. Historical baseline finding

Issue #65 establishes the intended historical boundary:

- production has a live migration `20260520000000_timetable_foundation_baseline`;
- that migration is absent from the repository;
- the missing foundation includes core objects such as `profiles`, `schools`, `classes`, `subjects`, `teacher_classes`, and `timetable_slots`;
- the recovery must be data-free and must preserve the existing production ledger.

This is materially stronger evidence than the original symptom-driven proposal to add only `schools`.

### Important correction

The **current production definitions of these tables cannot automatically be copied wholesale into the historical baseline**. Current production contains later schema evolution. For example, `timetable_slots` currently references `school_periods` and contains date-aware overlap constraints; those are associated with much later timetable migrations. Therefore a current-schema dump would risk importing post-baseline changes into the pre-ledger foundation.

The correct reconstruction target is:

```text
HISTORICAL BASELINE
  = authoritative pre-20260521 objects
  + dependencies required by those objects
  - objects introduced by later migrations
  - production data
```

The baseline must therefore be reconstructed from historical evidence plus current catalog evidence, not from the current table definition alone.

## 4. Current production catalog snapshot

Read-only catalog query results:

| Object | Count |
|---|---:|
| Public tables | 413 |
| Public views | 19 |
| Public functions | 871 |
| Public policies | 636 |
| Public non-internal triggers | 210 |
| Public tables without RLS | 0 |
| Public tables with FORCE RLS | 1 |

This is a catalog snapshot, not a substitute for the required structural diff.

## 5. Baseline candidate objects — production existence verified

The following documented baseline candidates exist in current production:

- `public.profiles`
- `public.schools`
- `public.classes`
- `public.subjects`
- `public.teacher_classes`
- `public.timetable_slots`

Current production also proves important dependencies that must be considered during reconstruction, including:

- `profiles.id -> auth.users(id)`
- `profiles.school_id -> schools(id)`
- `schools.created_by -> profiles(id)`
- `classes.school_id -> schools(id)`
- `classes.teacher_id -> auth.users(id)`
- `subjects.school_id -> schools(id)`
- `teacher_classes.teacher_id -> profiles(id)`
- `teacher_classes.class_id -> classes(id)`
- `teacher_classes.subject_id -> subjects(id)`
- `timetable_slots.teacher_id -> profiles(id)`
- `timetable_slots.class_id -> classes(id)`
- `timetable_slots.subject_id -> subjects(id)`
- `timetable_slots.school_id -> schools(id)`

This dependency evidence confirms why a one-table `schools` patch is not a complete foundation reconstruction.

## 6. Current production type evidence

Current production defines these relevant public enums:

```text
account_status = {active, restricted, suspended, anonymized}
school_status  = {pending, active, suspended, closed}
```

Their presence is evidence of current production dependencies, but their historical introduction date must still be established before they are admitted to the pre-ledger baseline.

## 7. Current catalog column evidence captured 2026-08-11

A fresh read-only `information_schema.columns` query against production verified the current definitions of the candidate foundation objects. Important examples:

- `schools` currently has 27 columns, including `requires_dual_approval`, `logo_url`, `motto`, `vision`, KNEC/NEMIS/location fields, and `name_normalized`.
- `profiles` currently has 21 columns, including `account_status`, anonymization/consent fields, notification preferences, `school_id`, `vc_id`, and onboarding state.
- `classes` currently has 7 columns, including `school_id`.
- `subjects` currently has 6 columns, including `global_subject_id`.
- `teacher_classes` currently has 7 columns and requires `school_id`, `teacher_id`, `class_id`, and `subject_id`.
- `timetable_slots` currently has 14 columns, including `effective_from`, `effective_until`, `updated_at`, and `period_id`.
- `school_periods` currently exists and contains `period_id`-style timetable configuration; it is therefore **not admitted to the historical baseline merely because it is currently present**.

This evidence strengthens the subtraction requirement: current production contains later mutations that must be attributed to their repository migrations before the historical baseline is emitted.

## 8. Provenance sweep — 2026-08-11

A repository-index search for the exact historical baseline marker and name did **not** expose the missing SQL body through the GitHub indexed source tree. The repository does contain reconciliation evidence identifying `20260520000000` as a live-only synthetic baseline, but no baseline SQL body was found in the current indexed tree.

This is **not proof that the file never existed**. It only means the current GitHub-indexed repository evidence did not expose the body. The new read-only instrument:

```text
scripts/l0/provenance-sweep-preledger.sh
```

performs the stronger local provenance sweep across all reachable refs, deleted/renamed migration paths, keyword commits, historical content hits, and unreachable git objects. Its output is intended to be committed under `docs/L0_EVIDENCE/provenance-sweep/` before any derived baseline is generated.

No production write is required for this sweep.

## 9. Repository mutation evidence already available

The TBL-006 collision register establishes that post-baseline migrations mutate baseline-owned timetable objects. In particular:

- `timetable_slots` is treated as baseline-owned;
- `teacher_classes` is treated as baseline-owned;
- `schools`, `classes`, and `subjects` are known to be absent from repository `CREATE TABLE` statements but are cross-cutting core tables and therefore require a separate core-schema reconstruction analysis;
- later migrations add timetable constraints, columns, functions, and policies.

Therefore the recovery artifact must subtract later mutations rather than dumping current production tables unchanged.

## 10. What is proven versus not yet proven

### Proven

- Production migration ledger currently contains 552 rows.
- The first live migration is `20260520000000 timetable_foundation_baseline`.
- The first repository replay migration fails because `public.schools` is absent.
- `report_schedules` also references `profiles`, so `schools` alone is insufficient.
- Production contains the documented core foundation candidates.
- Current production definitions contain later schema evolution that must not automatically be back-projected into the historical baseline.
- No production schema/data/ledger writes have been performed during this recovery work.
- The current GitHub-indexed repository does not expose the missing baseline body directly.

### Not yet proven

- Exact SQL body of the historical `20260520000000_timetable_foundation_baseline`.
- Exact historical object set at the baseline cutoff.
- Which current columns/constraints/triggers/policies were introduced after the baseline.
- Complete current production-vs-repository structural diff.
- Full clean replay after foundation reconstruction.
- A vs B outcome.

## 11. Recovery loop state

### Loop 0 — Instrument integrity

**State:** OPEN.

### Loop 1 — Historical foundation reconstruction

**State:** ACTIVE.

Current evidence chain:

```text
Blank replay
  -> 20260521083057
  -> missing public.schools
  -> report_schedules also requires public.profiles
  -> issue #65 identifies missing 20260520000000 timetable_foundation_baseline
  -> production proves candidate objects exist
  -> current production is NOT automatically the historical baseline
  -> indexed provenance search found no body
  -> local exhaustive provenance sweep is now the next evidence operation
  -> only if provenance fails: derive historical foundation by catalog + mutation subtraction
  -> replay
```

### Current stopping rule

Do **not** add guessed tables.

Do **not** use a current production dump as the historical baseline.

Do **not** modify the production migration ledger.

Do **not** begin Worker Engine implementation.

## 12. Next authorized action

Run the committed provenance instrument locally:

```bash
bash scripts/l0/provenance-sweep-preledger.sh
```

Then inspect:

```text
docs/L0_EVIDENCE/provenance-sweep/verdict.env
docs/L0_EVIDENCE/provenance-sweep/exact-path.log
docs/L0_EVIDENCE/provenance-sweep/content-hits.log
docs/L0_EVIDENCE/provenance-sweep/unreachable-objects.log
```

If the exact historical body is found, recover it and verify it in isolation before replay.

If it is not found, proceed to a **derived** pre-ledger foundation using:

```text
F0 = proven baseline candidates
     + dependency closure
     - post-20260520000000 repository mutations
     - platform-owned objects
     - production data
```

Then unit-test the derived artifact and run the blank replay. Every failure becomes an oracle event and is recorded before the next reconstruction iteration.

The first recovery artifact must remain data-free and explicitly marked **DERIVED FROM EVIDENCE** unless an exact historical source is recovered.

**Worker Engine coding remains BLOCKED.**

**L0 remains RED.**
