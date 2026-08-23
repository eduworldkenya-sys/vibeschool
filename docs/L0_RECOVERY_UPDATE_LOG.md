# L0 Recovery Update Log

This log is the forensic record of the foundation-recovery loop. Each entry records what was observed, what was changed, why it was changed, and what evidence must be used to judge the result.

## 2026-08-10 — Current Production Truth Recorded

A read-only audit recorded these current production facts in Issue #65:

- Production migration ledger: **552 rows**.
- Public tables: **413**.
- Public views: **19**.
- Public functions: **871**.
- Public policies: **636**.
- Non-internal triggers: **210**.
- All public tables have RLS enabled; one has FORCE RLS.
- **541 SECURITY DEFINER** public functions exist.
- **9 SECURITY DEFINER + anon EXECUTE** functions are an explicit security review set.
- No public SECURITY DEFINER functions with an unset `search_path` were found in the inspected catalog query.
- The isolated blank rebuild still fails at `20260521083057_report_schedules.sql` because `public.schools` is absent from the repository rebuild.
- The existing `hq_workforce_*` subsystem is substantial and already contains worker, skill, certification, run, handoff, context, verification, and memory concepts.
- Many inspected HQ/workforce objects do not have `school_id`; this is **not** permission to add it indiscriminately. Each object must first be classified as platform-global, school-scoped, or derived/bridge.

The earlier 546/339/198/348/141 reconciliation snapshot is explicitly stale. The current 552-row production ledger is the authoritative current observation and must be compared with a fresh repository migration inventory.

## 2026-08-10 — L0 Instrument Integrity / Telemetry Repair

### Problem observed

PR #74's L0 structural-diff workflow completed with failure, while the GitHub job logs returned `BlobNotFound`/404 and no trustworthy artifact was available. The workflow could terminate before the evidence upload stage.

### Root-cause finding

Production linking was a hard failure point, and the CLI setup action was also outside the evidence ledger. The recovery instrument could therefore fail before recording whether the failure was authentication, CLI setup, database startup, migration execution, schema dumping, Migra, or artifact publication.

### Decision

Do not infer success from missing telemetry. Every recoverable command must record its exit code, and the evidence directory must exist before risky operations begin.

### Changes applied

- `facd68517aa9b30a810a47a12e697f6e1351e5de` made production linking, local start/reset, dumps, and Migra non-fatal and recorded their exit codes.
- `9ad107dd72c9337d4d4b147c10578d13741bf59a` moved CLI installation into a captured shell step so CLI setup itself becomes evidence rather than an opaque action failure.
- `docs/L0_DECISION_PLAYBOOK.md` remains the frozen interpretation procedure.
- This log is the growing forensic record of why each recovery-loop change was made.

### Safety assessment

- Production writes: **none**.
- Worker Engine implementation: **none**.
- Baseline SQL: **none**.
- Production migration ledger: **untouched**.
- Purpose: telemetry/recovery process only.

## 2026-08-10 — Reverse-Engineering Loop: Production Catalog Interrogation

### Problem observed

The CI telemetry path remains non-admissible, but the production database itself is directly queryable through a read-only channel. Continuing to wait for CI would add latency without increasing the quality of the underlying evidence.

### Controlled action

Executed read-only PostgreSQL catalog queries against production project `yauqsxggtuxuykcbrtzf`.

### Evidence obtained

Production returned the known structural counts exactly:

- public tables / partitioned tables: **413**
- public views / materialized views: **19**
- public functions: **871**
- public RLS policies: **636**

The following known foundation candidates were confirmed present in production and RLS-enabled:

- `public.schools`
- `public.profiles`
- `public.classes`
- `public.subjects`
- `public.teacher_classes`
- `public.timetable_slots`
- `public.report_schedules`

The repository migration `20260521083057_report_schedules.sql` independently confirms that `report_schedules` requires `schools(id)` and `profiles(id)`, and its RLS policies query `profiles`. Therefore `schools` and `profiles` are proven prerequisites for that migration.

A production `pg_depend` interrogation also confirms substantial downstream dependency on these objects, including foreign keys, policies, triggers, and indexes. This is evidence for dependency ordering, not evidence that all dependents belong in the foundation.

### Interpretation

The production catalog is now a trusted witness for the existence of candidate foundation objects. The catalog count gate is green for the production side.

The six-object foundation set remains a **candidate**, not a conclusion. Foundation membership must still be derived from repository references and production intersection, then closed over actual prerequisites.

### Why this worked

The database catalog is a stronger source of structural truth than a serialized migration ledger. It lets the recovery loop distinguish:

1. object exists in production;
2. object is referenced by the repository replay;
3. object is created by the repository replay;
4. object is merely a downstream production dependent.

That distinction prevents symptom-driven DDL copying.

### Evidence committed

- `docs/L0_EVIDENCE/2026-08-10-production-catalog-seed-snapshot.md`
- `scripts/l0/catalog-foundation.sql`

### Safety assessment

- Production writes: **none**.
- DDL: **none**.
- DML: **none**.
- Migration ledger: **untouched**.
- Worker Engine: **untouched**.
- Baseline SQL: **not generated**.

## 2026-08-10 — Dependency Closure Discovery

### New evidence

A direct production foreign-key catalog query proved that the candidate foundation is not simply `schools`.

Observed prerequisite relationships include:

- `profiles.country_code` → `country_majority_ages.country_code`
- `profiles.id` → `auth.users.id` **(platform dependency)**
- `profiles.parental_consent_by` → `profiles.id`
- `profiles.school_id` → `schools.id`
- `schools.country_code` → `country_majority_ages.country_code`
- `schools.created_by` → `profiles.id`
- `classes.school_id` → `schools.id`
- `classes.teacher_id` → `auth.users.id` **(platform dependency)**
- `subjects.global_subject_id` → `subjects.id`
- `subjects.school_id` → `schools.id`
- `teacher_classes.class_id` → `classes.id`
- `teacher_classes.school_id` → `schools.id`
- `teacher_classes.subject_id` → `subjects.id`
- `teacher_classes.teacher_id` → `profiles.id`
- `timetable_slots.class_id` → `classes.id`
- `timetable_slots.period_id` → `school_periods.id`
- `timetable_slots.school_id` → `schools.id`
- `timetable_slots.subject_id` → `subjects.id`
- `timetable_slots.teacher_id` → `profiles.id`

### Critical finding

There is a production cycle:

`schools → profiles → schools`

This is not a defect by itself. It is evidence that foundation emission must be dependency-aware and may need PostgreSQL's normal table/constraint separation rather than naive topological ordering of tables.

### Rejected repair

The previously proposed one-table `schools` repair is now conclusively rejected as insufficient. It would not satisfy production-derived dependency closure.

### Platform boundary

`auth.users` is a Supabase platform object. It exists in the blank Supabase target and therefore must be excluded from the reconstructed public foundation. This validates the `− PLATFORM` term in the derivation formula.

### Evidence committed

- `docs/L0_EVIDENCE/2026-08-10-foundation-dependency-closure.md`

## 2026-08-10 — Derivation Loop Started

The recovery model is now formally:

`F0 = ((R ∩ P) − C) − PLATFORM`

followed by production dependency closure.

Where:

- `R` = objects required/referenced by repository migrations;
- `P` = objects proven present in production catalog;
- `C` = objects created by repository migrations;
- `PLATFORM` = objects supplied by the Supabase/Postgres platform and therefore already present in the blank target.

### Next controlled action

Build the repository-side `R/C` inventory using a parser-based migration analysis, calibrate it against `20260521083057_report_schedules.sql`, then compute the first foundation candidate set. No production DDL and no hand-authored foundation migration are permitted.

### Oracle rule

If replay later fails on an object `Y`:

- require the exact failure line;
- require `Y ∈ P` from production catalog evidence;
- add only the proven missing prerequisite/dependency;
- regenerate the derived foundation;
- replay again.

If more than five oracle iterations are required, stop adding objects and improve the reference extractor. That indicates instrument under-matching, not permission to guess.

## Current Gate State

| Gate / item | State | Meaning |
|---|---|---|
| Production catalog counts | **PASS** | 413 tables / 19 views / 871 functions / 636 policies observed directly |
| Production seed/dependency evidence | **PASS** | Candidate closure dependencies captured; platform boundary identified |
| Repository R/C extraction | **PENDING** | Parser-based derivation not yet executed |
| Foundation F | **PENDING** | Cannot be finalized before R/C |
| Derived foundation DDL | **BLOCKED** | No hand-authored or copied DDL permitted |
| Local clean rebuild | **RED** | Existing known failure remains |
| Structural diff | **BLOCKED** | Requires a trustworthy green local rebuild or admissible comparison evidence |
| Four-bucket classification | **BLOCKED** | Trust gate not passed |
| Outcome A/B | **BLOCKED** | Structural evidence incomplete |
| Worker Engine coding | **BLOCKED** | L0 remains RED |

## Absolute Rule

No `schools` migration, baseline migration, RLS rewrite, HQ migration, or Worker Engine implementation is authorized by this log. Evidence first; intervention second.
