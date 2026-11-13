# Grade 3 Mathematical Activities — curriculum map and Scheme alignment (13 November 2026)

## Source, edition, and scope

- Normal Grade 3 revised 2024 Mathematical Activities design: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.3.MATHEMATICS.ACTIVITIES.pdf
- Official lower primary catalogue: https://kicd.ac.ke/cbc-materials/lower-primary/
- Do not substitute the distinct Grade 3 design for learners with physical impairment. Its purpose/edition is separate.
- The ordinary source summary comprises **3 strands, 14 sub-strands and 150 suggested lessons**; standard weekly Mathematics allocation is **5 lessons**. Suggested total does not create a 30-week school calendar or a teacher Scheme automatically.

## Actual production readback

Read-only database inspection on 13 Nov 2026 of project `yauqsxggtuxuykcbrtzf` found **14 legacy Mathematics Grade 3 headings** in `cbc_strands`, **0** linked `curriculum_learning_outcomes`, **0** verified outcomes, **0** Grade 3 `scheme_of_work` rows and **0** Grade 3 records in `curriculum_authority_sources`. There is no source-artifact evidence for the requested private word-for-word transcription.

Existing legacy heading pairs match only six official headings (Numbers/Whole Numbers; Numbers/Fractions; Measurement/Length, Mass, Capacity and Time). The other eight official headings have no exact legacy pair. These are **candidate structural matches**, not official outcome matches. No legacy IDs, teacher Schemes, or student records are rewritten.

## Implementation in this branch

- `lib/teaching/grade3MathematicsCatalog.mjs`: complete **short source structural outline**, without source-exact detailed textual reproduction, synthetic outcomes, or calendar.
- `content/curriculum/grade3-mathematics-scheme-crosswalk-20261113.json`: auditable 14-row candidate crosswalk, real matching UUIDs only, recorded gaps.
- `components/teacher/curriculum/Grade3MathematicsMap.jsx`: searchable teacher curriculum outline and passage to the **existing** Scheme workspace.
- `app/teacher/scheme/AuthoritySchemePage.jsx`: Grade 3 Mathematics/Mathematical Activities uses that map, preserves user-selected class, subject, term and week; existing class/teacher-authenticated Scheme infrastructure remains the only save authority.
- No new table, RPC, public full-text source copy, duplicate curriculum engine, synthetic teacher assignment, or unapproved production data mutation.

## Remaining necessary completion gates

1. Use existing authenticated owner `curriculum_authority_register_source` and allowlisted authority intake to fetch and store the real publisher artifact, version, source hash and page-level evidence in the **restricted** reference layer. Owner states private copying permission exists; its technical and legal scope is not independently recorded as verified.
2. Reconcile every actual strand, sub-strand, exact outcome, suggested learning experience, inquiry, competency, value, PCI, rubric and source appendix through immutable observations and source snapshots. Do **not** relabel an outline as a word-for-word transcription.
3. Reconcile 14 legacy headings and their existing IDs with official structure, author appropriate separately identifiable VibeSchool original learning outcomes and guidance, and validate their permitted reference links. Do not promote unverified text or publish private source words into teacher/learner views.
4. Have an authenticated teacher with a real Grade 3 class, Mathematics assignment, saved instructional calendar and canonical outcomes select content through Curriculum Map → Scheme → Save. Verify actual `scheme_of_work.curriculum_outcome_id` and `scheme_lesson_outcomes` readback. A navigation button is **not** proof of a saved linked lesson.
5. Run current-head CI and a real teacher browser path before claiming end-to-end source-to-scheme certification.

**Status:** SOURCE_OUTLINE_MAPPED; LEGACY_IDENTITY_GAPS_RECORDED; TEACHER_MAP_NAVIGATION_IMPLEMENTED; PRIVATE_VERBATIM_SOURCE_NOT_INGESTED; OUTCOMES_NOT_CONNECTED; SCHEME_NOT_LINKED; NO_PRODUCTION_DATA_MUTATION.

## Follow-through: canonical connection prepared

- `supabase/migrations/20261113172000_grade3_mathematics_original_scheme_connection.sql` is an additive, fail-closed migration (not yet proof of production installation). It binds all 14 source-indexed units through the existing `cbc_strands` and `curriculum_learning_outcomes` tables, retaining the six identical existing heading IDs and adding only missing exact source-structural units. Existing 14 legacy headings are not deleted.
- The migration writes **28 VibeSchool-original starter learning outcomes** (two per unit), sources them as `creator_claimed`, and inserts complete non-verbatim guidance; **zero official KICD outcomes are claimed verified**.
- It extends the existing `commit_mapped_scheme_lesson` function to accept *only* active bound Grade 3 Mathematics units with complete learning guidance and correct authenticated teacher/class/subject/term/week/outcome identity. Existing user and school authority checks are preserved. A Grade 3 subject named **Mathematical Activities** is recognized only for this same canonical Mathematics taxonomy.
- Teacher Curriculum Map loads persisted outcome UUIDs, shows clear provenance, and opens the existing weekly Scheme. The same annual-draft engine uses the selected school calendar and existing weekly-allocation RPC, without creating a second Scheme service or silently saving teacher lessons.
- Safety checks: exactly 14 active bindings, 28 original outcome identities, 150 suggested lessons, no synthetic saved lesson, RLS guarded reads and authenticated-only Scheme RPC. Pending a real teacher save/reopen, `SCHEME_LINK_CERTIFIED` remains false.
- **Still incomplete:** full private word-for-word KICD transcription and official atomic source verification via authorized private intake; migration deployment proof; authenticated teacher browser save/readback; live release proof.
