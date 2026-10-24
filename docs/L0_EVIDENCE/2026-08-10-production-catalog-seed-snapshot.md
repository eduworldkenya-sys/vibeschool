# L0 Evidence — Production Catalog Seed Snapshot

**Date:** 2026-08-10  
**Branch:** `agent/worker-engine-freeze-l0`  
**Purpose:** Read-only evidence for foundation derivation.  
**Production project:** `yauqsxggtuxuykcbrtzf`

## Safety

- Production writes: **0**.
- DDL executed: **0**.
- Migration ledger changed: **0**.
- Worker Engine changes: **0**.

## Catalog inventory observed

A direct read-only PostgreSQL catalog query returned:

| Object class | Count |
|---|---:|
| Public tables / partitioned tables | **413** |
| Public views / materialized views | **19** |
| Public functions | **871** |
| Public RLS policies | **636** |

These match the current known production truth and therefore pass the production-count portion of the catalog sanity check.

## Known replay seed objects observed in production

The following objects all exist in production and have RLS enabled:

- `public.schools`
- `public.profiles`
- `public.classes`
- `public.subjects`
- `public.teacher_classes`
- `public.timetable_slots`
- `public.report_schedules`

This proves production contains the objects implicated by the known replay failure. It does **not** yet prove that the six named foundation objects are the complete minimum foundation.

## Repository-side evidence

The repository migration `20260521083057_report_schedules.sql` creates `report_schedules` and references both:

- `schools(id)`
- `profiles(id)`

It also creates RLS policies whose predicates query `profiles`.

Therefore `schools` and `profiles` are confirmed repository prerequisites for that migration. The remaining seed candidates (`classes`, `subjects`, `teacher_classes`, `timetable_slots`) remain evidence candidates from earlier recovery records and must be confirmed by repository reference extraction rather than assumed.

## Dependency evidence

A production `pg_depend` query shows that `schools`, `profiles`, `classes`, `subjects`, `teacher_classes`, and `timetable_slots` are deeply referenced by later production objects, including foreign-key constraints, policies, triggers, and indexes.

Important examples:

- `report_schedules_created_by_fkey` depends on `profiles`.
- `schools_created_by_fkey` depends on `profiles`.
- `fk_teacher_classes_class` depends on `classes`.
- `fk_timetable_slots_class` depends on `classes`.
- `teacher_classes_teacher_id_fkey` depends on `profiles`.
- `timetable_slots_teacher_id_fkey` depends on `profiles`.

The dependency graph is therefore useful for ordering and closure, but production dependents must not themselves be mistaken for the pre-ledger foundation. Foundation membership is determined from repository prerequisites intersected with production objects, followed by dependency closure.

## Current conclusion

**Finding:** The production catalog is healthy enough to interrogate directly and matches the known 413/19/871/636 inventory. The foundation problem is therefore now an evidence problem, not a production-connectivity problem.

**Next instrument:** derive repository `R`/`C` from the migration corpus, subtract platform objects, intersect with this production catalog, then compute dependency closure. No table DDL has been authored or copied yet.
