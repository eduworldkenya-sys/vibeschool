# L0 Evidence — Foundation Dependency Closure

**Date:** 2026-08-10  
**Source:** read-only PostgreSQL catalog interrogation of production `yauqsxggtuxuykcbrtzf`

## Finding

The candidate foundation is **not equivalent to `schools` alone**.

Production foreign-key metadata proves additional prerequisites and a platform boundary.

## Direct foreign-key dependencies of candidate objects

### `public.profiles`

- `profiles.country_code` → `public.country_majority_ages(country_code)`
- `profiles.id` → `auth.users(id)` **[platform object; do not reconstruct]**
- `profiles.parental_consent_by` → `public.profiles(id)`
- `profiles.school_id` → `public.schools(id)`

### `public.schools`

- `schools.country_code` → `public.country_majority_ages(country_code)`
- `schools.created_by` → `public.profiles(id)`

This creates a deliberate production dependency cycle:

`schools → profiles → schools`

The cycle is structurally valid because PostgreSQL can create the tables and apply the mutually dependent foreign keys in a dependency-aware dump/replay sequence.

### `public.classes`

- `classes.school_id` → `public.schools(id)`
- `classes.teacher_id` → `auth.users(id)` **[platform object; do not reconstruct]**

### `public.subjects`

- `subjects.global_subject_id` → `public.subjects(id)`
- `subjects.school_id` → `public.schools(id)`

### `public.teacher_classes`

- `teacher_classes.class_id` → `public.classes(id)`
- `teacher_classes.school_id` → `public.schools(id)`
- `teacher_classes.subject_id` → `public.subjects(id)`
- `teacher_classes.teacher_id` → `public.profiles(id)`

### `public.timetable_slots`

- `timetable_slots.class_id` → `public.classes(id)`
- `timetable_slots.period_id` → `public.school_periods(id)`
- `timetable_slots.school_id` → `public.schools(id)`
- `timetable_slots.subject_id` → `public.subjects(id)`
- `timetable_slots.teacher_id` → `public.profiles(id)`

## Architectural consequence

The earlier proposed one-table repair (`schools`) is rejected by evidence.

The correct derived-foundation process must account for at least:

- `schools`
- `profiles`
- `country_majority_ages`
- `classes`
- `subjects`
- `teacher_classes`
- `timetable_slots`
- `school_periods`
- required public types/sequences/functions/triggers/indexes/policies discovered through dependency closure

However, these are **candidate closure members**, not yet the final `F` set. Membership still depends on repository `R/C` extraction.

`auth.users` is explicitly a platform dependency and must be excluded from foundation reconstruction.

## Why this matters

This single catalog result proves why symptom-driven copying is unsafe:

> Adding `schools` by itself would be an incomplete repair because production itself proves that `schools` depends on `profiles`, and `profiles` depends on `schools` and `country_majority_ages`.

Therefore the foundation must be emitted as a production-derived, dependency-aware artifact rather than manually authored table-by-table.
