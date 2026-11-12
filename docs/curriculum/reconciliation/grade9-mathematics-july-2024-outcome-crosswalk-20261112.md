# Grade 9 Mathematics — July 2024 curriculum crosswalk and certification gate (12 November 2026)

## Mission and rule
Owner request: complete the missing Grade 9 Mathematics-specific learning outcomes, learning experiences, inquiry questions and curriculum certification, preserving KICD educational intent without copying KICD's copyrighted expression. This file records a *reconciliation working draft* only. It is not an official source-artifact record, a curriculum import, a learner textbook or a certification decision.

The mandatory authority process is `docs/curriculum/CONTENT_GENERATION.md`, existing `curriculum_authority_*` tables / authenticated operator, and `vs_curriculum_package_gate`. Do not bypass or weaken them.

## What was assembled in the existing candidate map

File: `content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json`, key `july_2024_editorial_crosswalk`.

- 5 KICD Mathematics strands and the 19 sub-strands in their listed order
- 117 **editorial manuscript aliases** individually corresponding to the specific learning-target slots observed in the July 2024 transcription. Aliases are NOT database UUIDs or claimed official outcome text.
- 57 VibeSchool-original suggested learning experiences, 26 VibeSchool-original inquiry questions, and a distinct sub-strand assessment-evidence brief for each of 19 sub-strands
- Every unit cites its printed source-page locator (pages 1, 3, 5, 6; 10, 12, 14; 18, 21, 23, 25, 27, 29; 34, 36, 38, 40; 45, 47). Inspect the **actual KICD PDF pages** before promotion. The numbers are taken from a third-party transcription and must be cross-checked.
- Editorial wording is original and designed to preserve the educational intentions, without reproducing the original curriculum passages, inquiries or the tables.

### Source authority and limitations

KICD official Grade Nine designs page: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/

Embedded official file title: **Mathematics Grade 9 - July 2024 - Revised.pdf**; registered source URL: https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview ; previously registered source UUID `97193d03-7eda-4124-93b1-1a3840647ca3`, version `July 2024 Revised`.

Editorial transcription consulted:
https://github.com/Vincent-mutwiri/KICD-Curriculum-Designs/blob/main/Grade_9/Mathematics%20Grade%209%20-%20July%202024%20-%20Revised.md

**Important:** This third-party Markdown is NOT an approved KICD PDF artifact; its content accuracy and completeness cannot stand in for the official PDF. The source is explicitly copyrighted. Do not rehost the document or import its verbatim passages. The 117 editorial slots and associated paraphrases are NOT verified official learning outcomes. Preserve the original user-approved goal of 100% educational-scope alignment, not 90% textual cloning.

The registered source has **zero artifacts**, **zero sealed/promoted snapshots**, and **zero promoted verified outcome records** at last read-only production check. Live `cbc_strands` contains 20 Grade 9 Mathematics legacy headings with zero embedded specific outcomes; no Grade 9 Mathematics canonical outcome UUIDs were observed. Protect those existing IDs, teacher schemes and past exam attempts.

### Source inconsistencies held open

| Unit | Conflict or ambiguity | Correct handling |
|---|---|---|
| 1.2 Cubes and Cube Roots | July summary lists 6 lessons, detailed page 3 lists 5 | Retain source-level contradiction |
| 1.3 Indices and Logarithms | July summary lists 8, detailed page 5 lists 6 | Retain source-level contradiction |
| 1.4 Compound Proportions and Rates of Work | July summary lists 9, detailed page 6 lists 12 | Retain source-level contradiction |
| 2.2 Straight Line | Summary title is singular, detailed page says `Equations of Straight Lines` | Preserve code 2.2, review naming |
| 5.2 Probability | Specific outcome references mutually exclusive events; a suggested experience says `mutually inclusive` | Determine correct source intention from original PDF |

No individual term/week pacing may be inferred from suggested sub-strand lessons. A teacher's Scheme of Work is a separate, teacher-owned allocation.

## Technical acceptance

Structural tests:
`node --test scripts/tests/grade9-mathematics-source-summary.test.mjs scripts/tests/grade9-mathematics-outcomes-candidate.test.mjs`

These checks must reject missing unit codes or outcome slots, duplicate manuscript aliases, invented canonical UUIDs, incomplete experience and inquiry fields and claims of source certification/publication. Their successful result proves *draft structural consistency only*.

For every target, the registered source PDF and exact page must be compared against the original learning meaning, experience, question, competencies, values, PCIs and assessment indicators; record MATCH/PARTIAL/MISSING/EXTRA/CONFLICT, and reconcile before claiming curriculum parity. Actual certification requires all mandatory outcomes matched and referenced by stable canonical UUIDs.

## Existing authenticated authority workflow — no parallel pipeline

1. HQ owner opens `/hq/curriculum-authority/grade9-mathematics` and the established source authority page.
2. Use the existing approved source UUID; do **not** create a duplicate source.
3. Run the authorized `curriculum-authority-intake` action `ingest_artifact` for the official registered URL. The edge function enforces host validation, PDF magic bytes or approved viewer-evidence mode, private source storage, and source SHA-256 generation. No fake hash.
4. Stage authenticated source observations for each exact KICD original outcome with page, code and experience/inquiry references. The candidate paraphrase array is review material only, **not** the authoritative source observation.
5. Seal and reconcile in the existing service lane; inspect per-observation classifications and missing hierarchy mappings.
6. Bind the correct canonical Grade 9 Mathematics sub-strands using existing owner-gated hierarchy workflow. Do not merge/rename the legacy 20 headings blindly or erase them. Rerun source reconciliation.
7. Carry out explicit authorized owner promotion of those observations only after all crosswalks are proven. Source registration approval is not outcome promotion.
8. Verify resulting `curriculum_learning_outcomes` UUIDs, source locators, learning experiences/inquiry metadata, and `vs_curriculum_package_gate` before any VibeSchool learner/teacher content publication.
9. Author the first verified outcome's Core + Supplementary + Revision + Teacher Support package under `CONTENT_GENERATION.md`; independently verify its learner/teacher delivery, then expand in scope.

**Current verified state**: curriculum structure/editorial reconciliation draft present in GitHub; **source authority and curriculum certification blocked** until steps 3–8 have actual evidence. No production schema/data write, certification claim or learner release is authorized by this draft.

## De-duplication and rollback

The only changed curriculum asset is the already-existing Grade 9 candidate JSON. No new curriculum table, authority RPC, content engine, teacher scheme, learner assignment, publishing route or examination table is introduced. Reverting this editorial commit does not mutate the live database.
