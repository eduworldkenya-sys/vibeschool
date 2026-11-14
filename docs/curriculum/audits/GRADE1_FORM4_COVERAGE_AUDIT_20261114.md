# VibeSchool — Grade 1–9 and Legacy Form 1–4 Curriculum Coverage Audit

**Snapshot:** 2026-11-14 (Africa/Nairobi)  
**Mode:** READ-ONLY production database inspection and repository cross-check. This Markdown is an evidence ledger, **not** publication, certification, source approval or a replacement for Cyborg mission state.  
**Database project:** `yauqsxggtuxuykcbrtzf`  
**Canonical references:** `AGENTS.md`, `docs/curriculum/CONTENT_GENERATION.md`, `docs/hq/CURRICULUM_CONTENT_COVERAGE.md`, and [ChatGPT-operated factory draft PR #1686](https://github.com/eduworldkenya-sys/vibeschool/pull/1686). The factory guide was absent from the inspected `main` branch.

## Findings and method

- The register holds **130 grade–subject entries** across **13 levels**. This is an internal registration count, not proof that 130 are all current officially required or equally mandatory learning areas; options, old names and subject combinations must be reconciled to KICD designs and phases.
- `curriculum` has records in Grades 4–6 and Forms 1–4, but **none** in Grades 1–3 or Grades 7–9. `curriculum_learning_outcomes` (joined by `curriculum_id`) contains **0 verified outcomes** for these 13 levels; rows that exist must not be equated with verified official KICD outcomes.
- `curriculum_authority_sources` has one approved **Grade 9 Mathematics, July 2024 Revised** source. The `curriculum_imports` table has no import for these 13 levels. Generic text such as “VibeSchool canonical curriculum import” in `grade_subject_authority.source_ref` is **not an identifiable official design edition or page reference**.
- `learning_resource_versions`: 46 certified versions and 14 candidate versions platform-wide. Grade-specific `learning_resources`: Grade 1 36, Grade 4 39, Grade 6 2. These resource counts and statuses do not establish full teaching-pack coverage.
- Publications are a **separate** system. After normalising grade-label case/spacing, Grade 1 has 1 published publication, Grade 6 has 1, Grade 9 has 1; Form 4 has **11 published publications, 146 published chapters, 2,489 published content blocks**. Grade 4 has 14 draft publications, Grade 9 has 26 drafts. Published status is not proof of curriculum reconciliation, independent assurance or successful learner read-back.
- There are subject-identity mismatches and unregistered publications: Grade 1 has public `Creative Activities` resources although its register says `Creative Arts and Sports`; Grade 4 “Science & Technology” versus curriculum “Science and Technology”; Form 4 published Biology, Chemistry-related drafts, Kiswahili, History & Government, Science, Other etc. without corresponding full authority register coverage. Do not silently merge these by guessed alias or declare those subjects finished.
- Grade 9 Mathematics has an approved July 2024 source record, but **zero** grade-9 rows in the checked `curriculum` table. A source record is not an outcome crosswalk. The current external reference is a Drive preview; inspect underlying edition/pages before asserting outcome verification.
- Official reference landing page: [KICD CBC Materials](https://kicd.ac.ke/cbc-materials/). KICD 2024 rationalised CBC curriculum designs are distinct from legacy 8-4-4 Form 1–4. This audit has not compared every official PDF page to every subject/outcome, so complete official syllabus coverage is **UNKNOWN**.

## Grade-level evidence

`Registered` = internal grade–subject register; `Curric subjects` = registered exact-normalised subject names matching `curriculum`; `Curric rows` = internal curriculum rows; `Outcomes` = outcome rows joined to those registered names (not verified); `Verified` = verified official outcomes within requested 13 levels; `Published pubs` = publication matches to registered subject names; `Public resources` = active/public learning resources matched to registered subject names. These latter exact matches exclude unmatched alias/orphan records.

| Level | Registered | Curric subjects | Curric rows | Outcomes | Verified | Published pubs | Public resources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Grade 1 | 9 | 0 | 0 | 0 | 0 | 1 | 3 |
| Grade 2 | 9 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grade 3 | 9 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grade 4 | 15 | 4 | 130 | 21 | 0 | 0 | 12 |
| Grade 5 | 15 | 2 | 52 | 0 | 0 | 0 | 0 |
| Grade 6 | 15 | 3 | 59 | 26 | 0 | 1 | 1 |
| Grade 7 | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grade 8 | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| Grade 9 | 16 | 0 | 0 | 0 | 0 | 1 | 0 |
| Form 1 | 1 | 1 | 3 | 15 | 0 | 0 | 0 |
| Form 2 | 1 | 1 | 6 | 30 | 0 | 0 | 0 |
| Form 3 | 1 | 1 | 4 | 20 | 0 | 0 | 0 |
| Form 4 | 7 | 7 | 80 | 633 | 0 | 6 | 0 |

## Registered subject evidence matrix (130 records)

A zero means **no matching record in the specified queried store**, not that no manuscript, assessment, unregistered or aliased item exists anywhere else. Comparison lowercases and strips spaces/punctuation/underscores; it does not invent semantic aliases. This is intentionally conservative.

| Level | Registered subject | Curriculum rows | Outcome rows | Published publication matches | Public resource matches | Audit state |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Grade 1 | Creative Arts and Sports | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | English | 0 | 0 | 1 | 3 | PARTIAL EVIDENCE |
| Grade 1 | Health Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Indigenous Languages | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Mathematics | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Science and Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 1 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Creative Arts and Sports | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Health Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Indigenous Languages | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Mathematics | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Science and Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 2 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Creative Arts and Sports | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Health Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Indigenous Languages | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Mathematics | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Science and Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 3 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | English | 39 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 4 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Kiswahili | 13 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 4 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Mathematics | 39 | 21 | 0 | 12 | PARTIAL EVIDENCE |
| Grade 4 | Science & Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 4 | Social Studies | 39 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 5 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Kiswahili | 13 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 5 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Mathematics | 39 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 5 | Science & Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 5 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Kiswahili | 13 | 0 | 0 | 0 | PARTIAL EVIDENCE |
| Grade 6 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Mathematics | 39 | 0 | 0 | 1 | PARTIAL EVIDENCE |
| Grade 6 | Science & Technology | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 6 | Social Studies | 7 | 26 | 1 | 0 | PARTIAL EVIDENCE |
| Grade 7 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Integrated Science | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Mathematics | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Pre-Technical Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 7 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Integrated Science | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Mathematics | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Pre-Technical Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 8 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Agriculture | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Arabic | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Christian Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Creative Arts | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | English | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | French | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | German | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Hindu Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Indigenous Language | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Integrated Science | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Islamic Religious Education | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Kiswahili | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Mandarin | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Mathematics | 0 | 0 | 1 | 0 | PARTIAL EVIDENCE |
| Grade 9 | Pre-Technical Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Grade 9 | Social Studies | 0 | 0 | 0 | 0 | NO MATCH IN CHECKED STORES |
| Form 1 | Computer Studies | 3 | 15 | 0 | 0 | PARTIAL EVIDENCE |
| Form 2 | Computer Studies | 6 | 30 | 0 | 0 | PARTIAL EVIDENCE |
| Form 3 | Computer Studies | 4 | 20 | 0 | 0 | PARTIAL EVIDENCE |
| Form 4 | Agriculture | 7 | 98 | 1 | 0 | PARTIAL EVIDENCE |
| Form 4 | Business Studies | 7 | 62 | 1 | 0 | PARTIAL EVIDENCE |
| Form 4 | Computer Studies | 5 | 25 | 0 | 0 | PARTIAL EVIDENCE |
| Form 4 | English | 28 | 130 | 1 | 0 | PARTIAL EVIDENCE |
| Form 4 | Geography | 12 | 52 | 1 | 0 | PARTIAL EVIDENCE |
| Form 4 | Mathematics | 10 | 122 | 1 | 0 | PARTIAL EVIDENCE |
| Form 4 | Physics | 11 | 144 | 1 | 0 | PARTIAL EVIDENCE |

## Additional nonregister matches / orphan content

- Form 4 **14 publications total** (11 published, 3 draft), **158 chapters** (146 published, 12 draft), **2,538 blocks** (2,489 published, 49 draft). Registered exact-match published publications = 6 of the 11; remaining are other subject names absent from current authority register.
- Grade 6 has **seven published Social Studies chapters with 141 published blocks**, and an active public Mathematics resource. Grade 1 has **15 active public platform Creative Activities resources**, 3 public publisher English resources, and an English publication with one published chapter/block.
- Grade 4 has 200 draft blocks across 14 draft publications, while its active/public Mathematics resources are a separate asset stream. Grade 9 has 167 blocks across 27 publications, of which 8 are published in Mathematics.
- Content may exist in GitHub manuscripts, assessments, other content tables, or under noncanonical aliases. Those are not counted as complete outcome packages without stable IDs and release/read-back evidence.

## Source-edition and integrity blockers

1. **BLOCKED_SOURCE_VERIFICATION:** Need a genuine, current, page-addressable source edition for each applicable KICD CBC/CBE subject and legacy 8-4-4 Form subject. The current register's generic source references do not satisfy that requirement.
2. **BLOCKED_MAPPING:** The requested levels currently have no verified outcome rows in the checked curriculum-to-outcome chain. Check exact outcome authority, alternate stores, unpublished imports and source snapshots before any state promotion.
3. **IDENTITY_CONFLICT:** Resolve subject aliases by canonical authority. In particular Grade 1 Creative Activities / Creative Arts and Sports; Grade 4 Science & Technology naming; Form 4 publications not registered; missing grade/subject labels.
4. **BLOCKED_COVERAGE_CLAIM:** Published chapters, raw blocks and draft files cannot be counted as whole-subject lessons or complete KICD coverage.
5. **PUBLISHING_GATED:** No publication, owner impersonation, protected RPC access, permissions changes, or self-certification performed. A live independent-learner test is still required per approved package.
6. **MISSION_EXECUTION_LIMIT:** This read-only audit and draft GitHub ledger were performed through available connectors; canonical local Cyborg mission compiler/loop, scope lease and exact-head CI were not executed in this connector session. Do not mark engineering mission COMPLETE or merge-ready solely from this document.

## Production queue — evidence-first

1. **Grade 4 Mathematics**: curriculum 39 rows/21 outcome rows, public Mathematics resources and working assessment entry points. Verify official edition/outcome IDs and reconcile draft book vs certified resource before an end-to-end learning package.
2. **Grade 1 English and Creative Arts**: one published English publication and public resources; resolve subject aliases and verify learning outcome crosswalk, then test one complete independent learner journey.
3. **Grade 6 Mathematics and Social Studies**: published social studies content and Mathematics resources; confirm curriculum and outcomes against official designs.
4. **Grade 9 Mathematics**: approved source record plus a published publication and assessment engine, but missing canonical curriculum rows; repair crosswalk rather than creating a second engine.
5. **Form 4 published collection**: audit 11 published publications / 146 chapters for learner read-back, curriculum versions, source rights and full register reconciliation, before marketing as complete.
6. **Grade 2–3, Grades 5, 7–8 and Forms 1–3**: register/source inventory first, then author candidate outcome packages; no full coverage inferred from absent rows.

## Completion states

Only mark an outcome MAPPED after exact source comparison, DRAFTED after original authored content exists, EDITORIALLY_CHECKED after actual checks, CERTIFIED after required independent evidence, PUBLISHED after authoritative release, and LEARNER_TESTED after real independent learner read-back. Update this ledger with evidence IDs and page/edition locators rather than fabricated percentages.

## Provenance

Read-only Supabase SQL against `grade_subject_authority`, `curriculum`, `curriculum_learning_outcomes`, `curriculum_authority_sources`, `curriculum_imports`, `vibe_publications`, `vibe_chapters`, `content_blocks`, `learning_resources`, `learning_resource_versions`, and `assessment_assignments`. Snapshot observations are ephemeral; rerun the queries before future certification. The matrix is scoped to 13 exact grade/form values and the table/column matching stated above.
