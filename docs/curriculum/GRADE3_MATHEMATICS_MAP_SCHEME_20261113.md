# Grade 3 Mathematics — KICD 2024 ↔ VibeSchool Scheme repair (13 November 2026)

## Source and scope
The official 2024 KICD Grade 3 Mathematical Activities design is the structural authority: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.3.MATHEMATICS.ACTIVITIES.pdf. It specifies **3 strands, 14 sub-strands, 150 suggested lessons and 5 lessons per week**: Numbers 101; Measurement 40; Geometry 9. Unit codes 1.1–3.2 are used as stable application selectors.

## Verified legacy production baseline
- Global Mathematics subject: `f430f8b3-9d8d-4845-8904-a3e597191ab6`.
- Fourteen existing `cbc_strands` records for Grade 3 Mathematics, of which only six match KICD units by title (Whole Numbers, Fractions, Length, Mass, Capacity, Time). All had no embedded outcome text, no `source_ref` and no verified linked outcomes at baseline.
- Legacy extra titles include Integers, Decimals, Area, Volume, 2D Shapes, 3D Objects, Angles and Coordinates. The migration **does not delete or repurpose** these historical IDs, even though they must not be presented as the current KICD Grade 3 map.
- No existing Grade 3 Maths `scheme_of_work` rows were found at baseline.

## Implementation
1. `grade3MathematicsCatalog.mjs` is a source-attributed structural curriculum map plus 42 **VibeSchool-original**, not source-exact, outcome guides, questions, experiences, resources and assessment suggestions. It is not a private word-for-word KICD transcription and not a source verification declaration.
2. Migration `20261113180500_grade3_mathematics_kicd_map_scheme.sql` reuses all six canonical matching UUIDs, creates only the eight missing units, links a restricted active 14-unit reader binding, records original active outcomes and unit guidance, checks 14/150/42 integrity and patches **existing invoker** `commit_mapped_scheme_lesson` to recognize the Grade 3 Maths binding. It never auto-creates a teacher Scheme.
3. Teacher Subject Hub, Curriculum Map and Scheme share one 14-unit catalog and actual canonical UUIDs. The legacy generic curriculum tile is hidden for this scope to avoid presenting wrong KICD headings.
4. Annual Scheme preview requires real terms and instructional weeks. Only an authenticated assigned teacher may choose an outcome and save via the existing RPC; readback on `scheme_of_work.curriculum_outcome_id` and `scheme_lesson_outcomes` is the final proof.

## Verification gates
- Static tests: exact counts and lesson allocations; migration/catalog equality; existing RPC selection; teacher hub/map connection; 150-lesson Scheme preview, missing-week negative controls.
- Live DB: query 14 active reader bindings, exact 150 active guidance lessons and 42 VibeSchool-original active outcomes; confirm matching six UUIDs stay constant. Verify teacher authorization and no change in Grade 3 English/Kiswahili.
- Teacher UI: choose a Grade 3 class + Mathematics (school assignment), open Curriculum Map, select unit, choose eligible week, select original outcome, save, reopen Scheme, confirm persisted outcome links. A successful GitHub merge or a preview alone is **not** certification of this live workflow.

**Status:** implementation pending CI, migration application, teacher-authorized readback and live deployment verification until checked independently.
