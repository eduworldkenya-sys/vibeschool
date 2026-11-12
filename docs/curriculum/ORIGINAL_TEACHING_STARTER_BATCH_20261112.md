# VibeSchool Originals — first teaching lessons across the remaining 11 subjects

**Created:** 12 November 2026  
**Authority:** KICD revised 2024 official curriculum designs (curriculum identity, learning intentions and progression); **not** KICD endorsement or reproduction  
**Status:** 11 original editorial manuscripts, **not imported, certified or published**. A repository manuscript is not itself a classroom resource or learner publication.

## Educational principle

**Keep KICD's curriculum original; make VibeSchool's teaching original and exceptionally clear.** Never alter a KICD strand or outcome to make a convenient exercise fit. VibeSchool adds explanations, carefully reasoned examples, practical instructions, independent practice, checking, differentiated support and teacher prompts. This gives teachers and learners a more usable learning experience without presenting the content as an official KICD book.

KICD designs are linked and attributed. Only structural headings and necessary concise factual scope are carried into content. Original reading passages, examples, practice and assessment explanations are VibeSchool-authored.

## Files and exact scope

| Grade | Manuscript | Subject first-lesson scopes |
|---|---|---|
| 4 | `content/curriculum/production/grade4-original-first-lessons.v1.json` | Mathematics 1.1 place value; English family listening; Kiswahili 1.1.1 matamshi bora; Indigenous Languages cultural-food listening |
| 6 | `content/curriculum/production/grade6-original-first-lessons.v1.json` | Mathematics 1.1 place value to millions; English child-labour theme listening; Kiswahili 1.1.1 matamshi bora and organs |
| 8–9 | `content/curriculum/production/grade8-grade9-original-first-lessons.v1.json` | G8 Mathematics integers; G8 English telephone etiquette; G8 Kiswahili mahojiano; G9 English euphemism |

**These are one original lesson per subject, not full-subject manuscripts.** The previous 873 original outcome descriptions in curriculum indices are *not* 873 fully written learner lessons. Do not report the subject as content-complete based on this batch.

## What each lesson contains

- A precise learner goal and learner-friendly explanation, with vocabulary.
- A worked example / demonstration with at least three ordered, reasoned steps; all mathematical steps explicitly explain *why* a transformation works, show a result and include a check.
- A feasible low-cost practical activity with learner evidence.
- Guided practice and independent exercise, each with an answer and explanation.
- A formative check with feedback, one common misconception and remedial and enrichment paths.
- Teacher facilitation, accessibility alternative and a grounded visual brief.
- A source-reference link, original authorship metadata and a draft-only release status.

**Additional safeguards:** Indigenous Languages uses a competent speaker and correctly sourced audio/text; no English-derived fake translations. Child-labour listening is sensitively designed; no disclosure is demanded. Classroom numerical and scenario figures are illustrative, not claimed as official statistics.

## Canonical integration rules

1. Keep the existing curriculum hierarchy, outcome IDs and Scheme of Work records unchanged. No existing teacher-owned lessons are rewritten by this batch.
2. These files are *authoring inputs* to the **existing** `learning_resources` → `learning_resource_versions` certification workflow. They are **not** a second classroom library or a new publishing authority.
3. The visible Teaching Library's optional resource slots stay optional. A single source can be reused in Lesson Notes, teacher guides, Scheme and VibeLearn after proper canonical publication; do not duplicate or hardcode reader content into each tool.
4. Where a source has only an index (Grade 4 Kiswahili, Grade 8 Kiswahili, Grade 9 English), `sourceRef` remains `null`; bind only after the real canonical curriculum outcome identity is established. Do not invent IDs.
5. Source pages and **individual specific KICD outcome correspondence still require full reconciliation** for these lessons, particularly Grade 6 English's theme-specific skills. Do not grant `official` or `verified` on the basis of this manuscript.
6. Review and revise the chosen language-specific script with a fluent speaker and rights check **before** Indigenous Languages learner delivery.
7. Apply the existing content certification and release controls, then verify a teacher read-back and an independent learner journey. A merged PR alone does not publish.

## Regression and editorial QA

`node scripts/test-eleven-original-editorial-packets.mjs` validates eleven unique grade/subject scopes, exact source index headings, canonical refs where present, original source links, draft-only status, useful explanations, reasoned steps, answer rationale, access notes and unique stable question IDs.

`node scripts/test-kicd-remaining-source-alignment.mjs` preserves the eleven source-structure integrity contracts (without claiming full outcome verification).

### Follow-on content production

Extend each subject one actual sub-strand at a time using `docs/curriculum/CONTENT_PACKAGE_TEMPLATE.md`: finish the KICD outcome crosswalk, author original teaching experiences for **every** required outcome, run factual/answer/rights checks, release eligible versions through existing authorities, and only then declare subject-wide completion once coverage is genuinely complete. Do not make one template fit every outcome.

**Current acceptance:** Original starter manuscripts plus draft integrity gates. **Not accepted:** eleven full KICD-reconciled books, official certification, or live public publication.
