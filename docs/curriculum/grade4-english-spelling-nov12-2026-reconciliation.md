# Grade 4 English, Kilimanjaro — spelling source reconciliation, 12 November 2026

## Scope and source

- KICD: *Grade 4 English Language*, first published 2017, revised 2024, [publisher-hosted document](https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.ENGLISH.LANGUAGE.pdf).
- Theme 11, **Sports: My Favourite Game**, strand **11.4 Writing**, sub-strand **11.4.1 Spelling: Commonly Misspelt Words**, printed **page 74** (zero-indexed PDF page 83).
- KICD assigns **2 lessons to this spelling sub-strand**. The school-wide English allocation is **5 periods per week** (source printed page v). They are different measures.
- Official learning intent, paraphrased: identify frequently misspelt words in oral/written contexts; spell them accurately in meaningful writing; develop careful, clear written communication.
- Official suggested methods, summarised: dictation, copy/check, word puzzles/jumbles, and constructing sentences; questions about spelling difficulty and improvement; critical thinking, learning to learn and responsibility.
- The official design does **not** establish that homophones or homonyms are the exact prescribed Grade 4 sub-strand. These may be limited supplementary examples if they serve spelling accuracy; do not relabel the official curriculum as a homophones sub-strand.

## Specific production findings (read-only verification, 12 November 2026)

- School: Gilgil Township, class: Grade 4 Kilimanjaro.
- Teacher profile: Mumbi2, ID `c49bf987-357f-46bc-98fb-9a326882e437`, with a valid teacher/class/subject assignment.
- Slot: `622ea0a6-f5d4-42c4-86be-836e1bbf6eb6`, Thursday 12 November 2026, 16:10–16:40 Africa/Nairobi.
- Teaching occurrence: `fe061bb8-89a4-407e-945c-772d63e93aea`, planned. School `term_weeks` identifies Term 3, Week 11, 10–16 November.
- Teacher's existing plan: `52e3aa53-f8a0-4831-b513-607f96dd20a3`, **Same-Sound Words**, 30 minutes, **draft**. It was created 12 November 2026 12:52 UTC; preserve its teacher-owned text and status.
- The plan has no `scheme_id`, `curriculum_outcome_id`, or `prepared_draft_id`. No teaching outcome or teaching resource is linked to it.
- Legacy Week 11 Scheme row `82be991c-2bca-44e4-8c84-5fc3d47a7672`, **Homophones and Homonyms**, uses older **Vocabulary / Word Study** sub-strand `3b5c39dd-f8f4-4b33-ae70-39771ccf6926`; no direct/multiple outcome or exact date/period is set. **Do not automatically bind it to Thursday.**
- Canonical Grade 4 English theme 11 writing unit `VS-CUR-G04-EN-2026#11-WR` uses sub-strand ID `4ac41f3b-25cb-49b7-af58-5d1b7c532ada`. Earlier 3 creator-authored outcomes are not close enough to satisfy the official spelling scope, and suggested lessons was 3.
- All 3 earlier outcomes had zero associated Scheme, plans, assessments, occurrences, chapter or resource records in the inspected production tables. This enabled an additive editorial repair that **archives but does not delete** the old outcome identities.
- The secure `attach_scheme_to_dated_lesson(uuid,uuid,uuid)` RPC is present in repository migration `20261112101800_timetable_dated_scheme_binding.sql` but was **absent from production** when checked; it must be deployed through governed migration release, not emulated using privileged manual updates.

## Editorial repair in this branch

The guarded forward-only migration `20261112161000_grade4_english_spelling_editorial_alignment.sql` requires the exact original three active, unreferenced outcomes. It archives those records and creates three new **VibeSchool-original** creator-claimed active outcomes (codes `VS-G4-EN-11-WR-04/05/06`) for (1) recognition, (2) accurate dictation/sentences, (3) self-correction and careful writing. It corrects `curriculum_unit_guidance.suggested_lessons` to the **KICD source's 2** and refreshes teacher guidance.

No record is promoted to `official` or `verified`. No source-approval user, source snapshot, checksum or reviewer decision is manufactured; authority registration/reconciliation remains separate. Existing `teacher_profiles`, `scheme_of_work`, `lesson_plans`, `teaching_occurrences`, resources, assessments and history are not modified by this change. The source catalog's 150-lesson **local VibeSchool proposal** continues to include an optional third spelling-practice period; the teacher UI explicitly distinguishes that from KICD's 2 source lessons.

## Acceptance and next gate

1. Apply through exact-head reviewed/approved release and requery the 3 archived + 3 new active outcomes, the 2 lesson guidance, reader association and absence of historical mutations. Do not claim this from the GitHub commit alone.
2. Register/approve the Grade 4 source through VibeSchool's **existing authenticated authority process** and reconcile specific outcome evidence. Creator-claimed does not mean official.
3. The teacher, using their own authenticated session, must choose the correct Scheme lesson and its academic week/date. If the old Word Study Scheme entry is wrong, preserve it and create/correct the intended Scheme entry using the authorized teacher UI. Do not use title similarity to rewrite the dated lesson.
4. Deploy and verify the existing guarded dated-Scheme attachment RPC. Invoke it as the teacher only after the exact Scheme and outcome are established; validate `school_id`, `class_id`, `subject_id`, Week 11, slot and date.
5. Then assemble Core + Supplementary + Revision + Teacher Support. Review one 30-minute sequence with genuine oral modelling, dictation/independent exercise-book writing, answer key, error feedback, support and extension. The existing manual **Same-Sound Words** draft may supply selected context examples but is **not a completed KICD spelling package**.
6. Persist the reviewed lesson via the existing authenticated `lesson_plans` / `lesson_plan_drafts` flow, check its exact ID and all source links, open it as Mumbi2 and test learner/teacher surfaces. Keep it draft until release gates pass.

### Status

**Evidence-backed content scope:** KICD source §11.4.1 established, KICD two-lesson requirement established, VibeSchool-original editorial repair proposed on branch.

**Still blocked for exact scheduled lesson:** official authority promotion/reconciliation, production migration status, teacher-confirmed Scheme assignment, authenticated draft attachment, full resource package QA and live UI verification. Do not label as released, taught, certified, or ready.
