# L0 Foundation Scope Evidence — 2026-08-11

**Project:** `yauqsxggtuxuykcbrtzf`
**Historical boundary:** `20260520000000`
**Status:** evidence captured; baseline not yet emitted

## Purpose

Record the scope correction discovered while deriving the missing synthetic baseline. This document is not a migration and contains no production data.

## Provenance

The repository provenance sweep has closed the historical-source branch: the exact `20260520000000_timetable_foundation_baseline.sql` body was not found in reachable history, unreachable Git objects, or repository SQL content. The repository's own reconciliation material independently classifies the version as `SYNTHETIC_BASELINE / live_only`.

## Scope correction

The timetable seed set remains:

- `schools`
- `profiles`
- `classes`
- `subjects`
- `teacher_classes`
- `timetable_slots`
- `country_majority_ages`

However, the production foreign-key dependency closure is broader than those seven names. Current catalog traversal reaches `school_periods` and `auth.users`.

`school_periods` is **not** admitted to the historical baseline because repository evidence proves it was created later by `20260719104519_fix21_school_periods.sql`.

`auth.users` is platform-owned and is not a repository baseline object.

## Important broader finding

The full repository replay also references other pre-existing core objects that are not created by the repository's early migrations. For example, `20260521204108_funhub_schema.sql` references `profiles`, `students`, and `classes`, while `20260626100000_fix_teacher_onboarding_trigger.sql` references `teacher_profiles`, `school_members`, and `academic_terms` without creating those tables.

Therefore the final pre-ledger foundation cannot safely be limited to the seven timetable seed tables. The final baseline scope must be the complete set of data-free pre-ledger objects required for the repository migration chain, after excluding platform-owned objects and subtracting post-baseline repository mutations.

## Known mutation evidence

Confirmed later repository mutations include:

- `20260717214543_make_teacher_classes_class_id_not_null.sql` — changes `teacher_classes.class_id` to `NOT NULL`.
- `20260717162232_add_timetable_overlap_exclusion_constraints.sql` — adds the original three timetable overlap exclusion constraints.
- `20260717215951_upgrade_overlap_constraints_to_date_aware.sql` — replaces those constraints with date-aware definitions.
- `20260719104519_fix21_school_periods.sql` — creates `school_periods` and adds `timetable_slots.period_id`.
- `20260525210349_add_timetable_slot_id_to_lesson_plans.sql` — adds the later `lesson_plans.timetable_slot_id` dependency on `timetable_slots`; this does not belong in the baseline itself.

## Current production evidence

The current production catalog confirms later-evolved definitions and therefore cannot be copied wholesale into the baseline. In particular, current `timetable_slots` contains `period_id` and date-aware overlap constraints, and current `teacher_classes.class_id` is non-null.

## Recovery rule

The next baseline derivation must produce:

```text
B = historical pre-ledger object set
    + required dependencies
    - platform-owned objects
    - repository objects introduced after 20260520000000
    - post-baseline columns / constraints / indexes / policies / triggers
    - production data
```

The result must be marked `DERIVED FROM EVIDENCE` until blank replay and structural equality establish the reconstruction.

No production schema, data, or migration ledger change was made while producing this evidence.
