# Grade 9 English — Canonical Scheme activation follow-through (13 November 2026)

## Verified baseline, before this change

- The existing `content/curriculum/grade9-english-2024-index.json` includes **15 themes, 75 sub-strands, 150 suggested lessons** (five English lessons per week).
- Existing production `cbc_strands` has **75/75 source-ref-identical Grade 9 English units**; 12 pre-index headings remain untouched.
- Production has **0** Grade 9 English `curriculum_learning_outcomes`, **0** `curriculum_unit_guidance` records, **0** Grade 9 English Scheme lessons, **0** complete unit inquiry/experience pairs and **0** Grade 9 English `curriculum_authority_sources` records.
- The registered source locator in the index points to [the official KICD Grade Nine Designs page](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/) and its English Google Drive preview `https://drive.google.com/file/d/1ehe01q4q8G-ft1PsA0r7skcz6grZfiNQ/preview`; **this is a locator, not an ingested or cryptographically verified source artifact**.

## Implementation

1. `supabase/migrations/20261113115000_grade9_english_outcome_scheme_activation.sql` patches the **existing** `commit_mapped_scheme_lesson` invoker function, preserving all existing Grade 1/4/6/8 branches, login and assignment checks, subject/grade checks, school-calendar/term/week validation, and writes to the canonical `scheme_of_work` and `scheme_lesson_outcomes` tables. It fails closed if the function definition drifts or there are not exactly 75 Grade 9 English indexed units.
2. The new Grade 9 English clause only recognizes exact `VS-REF-G09-EN-2024#<theme>.<lane>.1` persisted headings owned by the global English subject. The existing function already requires 1–12 distinct, active, `creator_claimed` outcomes whose `source_ref` extends that exact unit's reference. The new clause also enforces nonempty key inquiry, experiences, learning resources and assessment methods, plus active canonical guidance.
3. The existing Scheme UI now resolves a selected Grade 9 English code to its audited persisted UUID (from the 75-unit read-only crosswalk), reads *only* its active VibeSchool-authored eligible outcomes and guidance through existing Supabase tables, and shows the existing **Add to Week Scheme** control only when that content is complete. No automatic lesson is written on navigation, no synthetic teacher identity is used.
4. A missing or denied source, missing guidance, no eligible outcomes, incomplete inquiry/experiences, or a week outside the instructional calendar continues to be a block, **not** an asserted saved Scheme. 
5. Regression tests run in `test:curriculum-identity`: the existing Grade 9 English map/index/crosswalk tests plus `scripts/tests/grade9-english-scheme-activation.test.mjs`.

## Boundaries and next required source work

This is **a ready-for-original-content Scheme pathway**, not full KICD transcription, curriculum certification, source promotion, or a teacher save success claim. No official full text enters the public repository, public reader or client bundle.

Use the existing **authenticated owner** `curriculum_authority_register_source`, allowlisted `curriculum-authority-intake`, private `curriculum_authority_artifacts`, source-exact `curriculum_authority_observations`, immutable `curriculum_authority_snapshots`, reconciliation and promotion sequence. Verify original October 2024 PDF bytes, page evidence, hash, scope and permitted restricted storage before claiming a complete copy. Do not insert an approval directly with service-role SQL, invent `auth.uid()`, or register an empty snapshot.

Then author and review VibeSchool-original outcomes and practical guidance against each verified source sub-strand. Promote via existing authorized curriculum controls. Only an authenticated teacher with a real assigned Grade 9 class, subject, term and instructional week may save the Scheme via the already-existing RPC. Read back actual `scheme_of_work.curriculum_outcome_id` and `scheme_lesson_outcomes` to certify a live connection. Full privacy, rights evidence and source completeness remain separate gates.
