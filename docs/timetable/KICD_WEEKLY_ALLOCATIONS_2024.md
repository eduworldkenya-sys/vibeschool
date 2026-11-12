# KICD 2024 national weekly allocations — Grades 1–9

## Source authority and exact published timetable

**Lower primary, Grades 1–3:** 30 curriculum lessons + 1 Pastoral/Religious Instruction Programme (PPI) = **31 periods per week**. Official KICD Grade 1–3 English Activities revised 2024, lesson allocation page ix:
https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf

**Upper primary, Grades 4–6:** 34 curriculum lessons + 1 PPI = **35 periods per week**. Official KICD Grade 6 Agriculture revised 2024, lesson allocation page ix:
https://kicd.ac.ke/wp-content/uploads/2024/10/AGRICULTURE-Grade-6-30.07.2024.pdf

**Junior school, Grades 7–9:** 40 curriculum lessons + 1 PPI = **41 periods per week** (40 minutes per subject lesson). Official KICD Grade 9 Agriculture 2024, lesson allocation page viii:
https://kicd.ac.ke/wp-content/uploads/2024/06/Agriculture-Grade-9-Formatted-April-2024.pdf

| KICD learning area | G1–3 | G4–6 | G7–9 |
| --- | ---: | ---: | ---: |
| Indigenous Language Activities | 2 | — | — |
| Kiswahili / Kenya Sign Language | 4 | 4 | 4 |
| English | 5 | 5 | 5 |
| Mathematics | 5 | 5 | 5 |
| Religious Education | 3 | 3 | 4 |
| Environmental Activities | 4 | — | — |
| Creative Activities | 7 | — | — |
| Science & Technology | — | 4 | — |
| Agriculture | — | 4 | 4 |
| Social Studies | — | 3 | 4 |
| Creative Arts | — | 6 | — |
| Integrated Science | — | — | 5 |
| Pre-Technical Studies | — | — | 4 |
| Creative Arts and Sports | — | — | 5 |
| **Curriculum lessons** | **30** | **34** | **40** |
| **PPI (separate programme)** | **1** | **1** | **1** |
| **All periods** | **31** | **35** | **41** |

The table lists **one learner's selected alternative**, not additional periods for every alternative faith or language. KSL and Kiswahili are alternatives; CRE/IRE/HRE share one Religious Education allocation. Optional Indigenous/foreign-language curriculum *designs* outside the lower-primary core matrix do not by themselves establish an additional mandatory national timetable allocation.

## VibeSchool canonical implementation

- The canonical authority is `public.subject_weekly_allocations`; the class/term effective source remains `public.class_subject_allocations`. No competing scheduling engine or new official curriculum identities.
- The existing Grades 1–6 2023-labelled seed is reconciled against the source at the original 20261112101500 **pending** forward migration; the junior-school baseline is inserted there, preserving `grade,subject_label` stable record identities and linked teachers.
- `kicd_learning_area` stores the source term separately from the VibeSchool canonical `subject_label`. For example VibeSchool's `Creative Arts and Sports` maps to KICD upper-primary `Creative Arts`. This is an **allocation alias**, not evidence that every existing curriculum package is a complete KICD outcome map.
- `timetable_allocation_subject_aliases` connects existing subject IDs: religious alternatives, KSL, upper-primary Agriculture, Creative Arts and Science & Technology, and lower-primary mathematical/indigenous variants. It never deletes or renames teacher records.
- PPI is **one separate weekly programme period**. It is shown in the invoker-security `kicd_weekly_grade_allocation` read-only view. It is **not** a 10th assessed junior-school subject, and does not create an automatic timetable clock time.
- An all-grade fail-closed migration contract requires exactly 7/8/9 subjects and 30/34/40 subject lessons for the three bands, all with national source locators. A mismatch aborts the migration transaction.
- Lesson durations: 35 minutes for Grades 4–6 per already tracked Ministry timetable policy, 40 minutes for junior school per KICD Grade 9; lower-primary duration is not guessed from a source that only specifies counts.

## Verification and release gates

Production observation *before this migration*: Grades 1–3 have 7 rows/30 lessons each; Grades 4–6 have 8 rows/34 each; Grades 7 and 9 have no national rows, Grade 8 has only one row. Some actual class/term allocations have missing baseline IDs. This is a **failure state**, not a pass.

1. Run `node --test scripts/test-timetable-reconciliation.mjs` and the existing timetable/CI suites on the exact PR head.
2. Rebuild database schema under the existing **TBL-011 / TBL-013** stage and verify the production ledger. Do not bypass the already-applied 20261112104242 unscheduled-teaching version or replay it under a new filename.
3. Apply the pending migrations **in their established order**, only after dry-run and source/schema authorization gates. Then query `public.kicd_weekly_grade_allocation`; expect 9 rows with the totals 31, 35 or 41 as appropriate.
4. Verify actual `classes.grade_code`, national lookup, school-period schedule, and class/term effective allocations; preserve legitimate school overrides and historical slots. Confirm PPI appears exactly once on the school timetable without creating a fake lesson.
5. Certify a real Grade 4 Kilimanjaro teacher timetable and a representative junior-school class with authenticated access; don't call a blank school period configuration 'verified'.

Do not equate a merged GitHub migration with production execution or live timetable certification.
