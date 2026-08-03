# TBL-006 Forward-Collision Register

Machine-readable source of truth: `supabase/reconciliation/tbl006_collision_register.json`.
Validated by: `scripts/validate-tbl006-collision-register.py`.

This document and its JSON counterpart are read-only reconciliation artifacts.
They do not modify Supabase and do not contain or apply SQL themselves.

## How this was built

Repository-only static analysis. No `.git` history and no live Supabase
connection were available in the session that produced this register — see
`metadata.limitations` in the JSON file. Baseline-owned objects were inferred
by exclusion: any table referenced by post-baseline migrations with no
`CREATE TABLE` statement anywhere in `supabase/migrations/` is treated as
owned by the live-only `20260520000000_timetable_foundation_baseline`.

Confirmed baseline-owned timetable objects: `public.timetable_slots`,
`public.teacher_classes`.

`public.schools`, `public.classes`, `public.subjects` are also absent from
repo `CREATE TABLE` statements but are cross-cutting core tables used well
outside the timetable domain — excluded from this register, flagged for a
possible separate core-schema register.

## Headline finding (HIGH risk)

`20260717215951_upgrade_overlap_constraints_to_date_aware.sql` and
`20260718054252_timetable_room_conflict_fix12.sql` both add a constraint
named `excl_room_overlap` on `public.timetable_slots` with the same
definition. The second file has no `drop constraint if exists` before its
`add constraint`. On a clean rebuild from blank state (TBL-011), this will
raise a Postgres "constraint already exists" error. This must be resolved
before TBL-011 (isolated clean rebuild) can pass.

Fix options:
1. Add `alter table public.timetable_slots drop constraint if exists excl_room_overlap;` immediately before the `add constraint` block in `20260718054252_timetable_room_conflict_fix12.sql`.
2. Or delete the redundant constraint block from that file entirely, since the definitions are identical.

This is a repository-file fix only — it does not require a database write,
since both migrations are already `PARITY_APPLIED` on the live ledger
(the collision only bites a *fresh* rebuild, not the already-applied live
database).

## Full entry table

| Migration | Object | Operation | Collision type | Risk | Status |
|---|---|---|---|---|---|
| 20260717162232 | timetable_slots | ADD CONSTRAINT x3 | SUPERSEDED_BY_LATER | MEDIUM | OPEN |
| 20260717162241 | timetable_slots | DROP/CREATE POLICY x2 | NONE_DETECTED | LOW | VERIFIED_IN_REPO |
| 20260717214543 | teacher_classes | ALTER COLUMN NOT NULL | NONE_DETECTED | MEDIUM | COVERED_BY_TBL-005 |
| 20260717215951 | timetable_slots | DROP+ADD CONSTRAINT x3 | INTENTIONAL_SUPERSESSION | MEDIUM | OPEN |
| 20260718054252 | timetable_slots | ADD CONSTRAINT (dup) | **DUPLICATE_OWNERSHIP** | **HIGH** | **OPEN — blocks TBL-011** |
| 20260718054252 | timetable_slots | CREATE FUNCTION create_timetable_slot | SUPERSEDED_BY_LATER | LOW | VERIFIED_IN_REPO |
| 20260719104519 | timetable_slots | ADD COLUMN period_id | NONE_DETECTED | LOW | VERIFIED_IN_REPO |
| 20260719104505 | timetable_slots | CREATE FUNCTION x4 (RPCs) | NONE_DETECTED | LOW | OUT_OF_SCOPE_FOR_TBL-006 |
| 20260718151116 | teaching_occurrences (new) | CREATE TABLE + FK | DEPENDENCY_ONLY | LOW | VERIFIED_IN_REPO |
| 20260720123500 | timetable_slots | CREATE FUNCTION (replace) | SUPERSESSION_OF_20260718054252 | LOW | VERIFIED_IN_REPO |

See the JSON file for full evidence strings per entry.

## Required known entries

Per TBL-006 scope, the validator confirms:
- every migration filename in `supabase/migrations/` dated after `20260520000000` that textually references `timetable_slots` or `teacher_classes` has a corresponding entry in this register (fails otherwise);
- every `migration_filename` in the register still exists on disk (fails otherwise);
- the one known `duplicate_or_contradictory_ownership_flags` entry is present (fails if silently removed without resolution).


## TBL-006 closure — 2026-08-03

Status: **VERIFIED**

- Every current migration referencing `timetable_slots` or
  `teacher_classes` is registered.
- Repository-only duplicate Fix 28 version `20260720123500` was removed.
- Final live-version source remains at `20260720200607`.
- Fix 12 now drops `excl_room_overlap` before recreating it.
- No production database write occurred.
- Next fix: TBL-007.
