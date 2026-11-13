# Gredi ya 3 Kiswahili — Curriculum Map and Scheme reconciliation (13 Nov 2026)

## Verified existing production state

Read-only inspection of Supabase project yauqsxggtuxuykcbrtzf, canonical global Kiswahili subject 66514041-351d-42f0-b4f5-86c60ee2b88f, at Grade 3:

- 12 existing public.cbc_strands rows. All 12 have source_ref IS NULL, no recorded source-order metadata, and no embedded learning outcomes.
- 0 linked public.curriculum_learning_outcomes for these 12 existing row IDs.
- 0 saved public.scheme_of_work rows for Grade 3 Kiswahili.
- The lower-primary timetable allocation already records **4 Kiswahili/KSL alternative lessons per week**. This is not a claim that any specific strand owns a particular calendar week.
- The official Grade 1–3 Kiswahili PDF (second edition 2024, ISBN 978-9914-43-071-4) has been located. An authenticated restricted source artifact, exact source hash and page-by-page verified transcription have not been established.

The 12 stored legacy headings are an **incomplete legacy navigation index**, not 12 verified official KICD sub-strands. Preserve their UUIDs and their historical relations; do not overwrite or pretend title matches prove source coverage.

## Current app wiring

1. Existing app/teacher/scheme/AuthoritySchemePage.jsx detects Grade 3 Kiswahili by the selected real teacher class/subject; global Kiswahili identity is resolved through the existing subject-FK resolver, not fuzzy names.
2. The page reads matching cbc_strands and eligible active **VibeSchool-original** curriculum_learning_outcomes. The reader displays the 12 existing labels and missing-link state; it never embeds official KICD wording in the public Next.js bundle.
3. The teacher can choose a known persisted sub-strand ID and open the **same canonical** /teacher/scheme route with that ID in its URL. The Scheme page shows a read-only planning reference until legitimate original outcomes, authority checks and teacher-term-week data are ready.
4. Scheme writes, if and when eligible, remain solely within the existing teacher-invoker commit_mapped_scheme_lesson RPC and canonical scheme_of_work / scheme_lesson_outcomes. No unassigned teacher, auto-commit, dummy term/week, independent Scheme engine or production SQL seed has been introduced.
5. Existing 12 rows, teacher schemes, other grades and historical UUIDs are not mutated by this UI change.

## Official source and restricted word-for-word copy

- Official KICD Lower Primary Grade 1–3 designs: https://kicd.ac.ke/cbc-materials/lower-primary/
- KICD Kiswahili embedded document locator: https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-Kiswahili-Revised.pdf
- Governing private source-transcription process: docs/curriculum/COPY_KICD_CURRICULUM.md. The owner's permission assertion is already recorded there.

The official KICD 2024 PDF is publicly locatable and partially text-searchable. Its contents show Grade 3 beginning at printed page 184, assessment rubrics beginning at printed page 268, and the CSL appendix beginning at printed page 274. The web PDF reader cannot reliably inspect/render all pages for exact source-text comparison; no full page-by-page private transcription or verified source hash was imported. No verbatim KICD text was copied into GitHub or the public client. The private source layer, specific rights evidence, page inventory and true source-equivalence audit remain **NOT VERIFIED**; it is incorrect to label this private transcription complete.

## Completion gates still required

1. Intake the current full official KICD Kiswahili Gredi 1–3 design via existing authorized private curriculum-authority registry, including immutable artifact, source version, page boundaries, rights scope and per-item exact-text observations.
2. Reconcile **all** official strands and sub-strands against canonical rows; preserve existing UUIDs where genuinely equivalent, and distinguish mismatches from missing content.
3. Record each atomic outcome, experience, inquiry, competency, value, PCIs, assessment rubrics and appendices in existing restricted source authority and permitted original VibeSchool representation; compare page/source counts and exact punctuation/order.
4. Add tested, source-reconciled, individually linked original VibeSchool outcomes and guidance; enable the established teacher-authorized Scheme save only when commit_mapped_scheme_lesson supports the Grade 3 Kiswahili binding with all existing class/term/week and RLS checks.
5. Save a representative teacher lesson in an actual assigned Grade 3 class, then read back scheme_of_work.curriculum_outcome_id and scheme_lesson_outcomes. Test unauthorized and wrong-grade/wrong-subject negative paths, exact-head CI, private source isolation and production UI before declaring connection complete.

**Implementation state:** partial read-only Curriculum Map → Scheme navigation, not a full KICD copy, not connected/saved Scheme outcome rows, not production content certification.

## Grade 3 Kiswahili Scheme implementation extension (13 November 2026)

A subsequent implementation wires the existing Grade 3 Kiswahili Curriculum Map to the **same** teacher Scheme write contract rather than stopping at a read-only navigation reference:

- The Curriculum Map passes the persisted `cbc_strands.id` as `unitId`, together with the teacher's real selected class, subject, term and instructional week. The Scheme can return to that same curriculum sub-strand from a saved linked lesson.
- The Scheme reads active VibeSchool-original outcomes and active `curriculum_unit_guidance` for those persisted identities. It offers a multi-outcome selection and **Add to Week Scheme** only if the sub-strand has a valid `VS-CUR-G03-SW-2026#<unit>` source reference, active exact-prefix outcome references, nonempty key inquiry, learning experiences, learning resources and assessment methods.
- `supabase/migrations/20261113150000_grade3_kiswahili_canonical_scheme_activation.sql` patches the existing **security-invoker** `commit_mapped_scheme_lesson` only. It preserves its authenticated teacher-assignment, grade, canonical global-subject, school term/week and selected-outcome checks, and the atomic `scheme_of_work` + `scheme_lesson_outcomes` linkage. Its fail-closed patch guard requires the already deployed Grade 9 English extension; no second Scheme engine or artificial teacher records are created.
- The displayed four lessons per week is an allocation, **not** an automatic term-week assignment or KICD page-verification claim. No Scheme row is written on map navigation.
- Exact-identity and negative-path regression checks run in the existing `test:curriculum-identity` suite.

**Production data gate remains:** the last read-only Supabase audit found 12 legacy headings but **zero Grade 3 Kiswahili outcome records, zero active teaching guides and zero saved Scheme lessons**. The code supports a real save once authentic, source-reconciled and approved VibeSchool records are entered and the migration is deployed. Until those exist, the UI correctly keeps the save action unavailable. A GitHub merge is not the same as a migration applied in production or a teacher save/readback.
