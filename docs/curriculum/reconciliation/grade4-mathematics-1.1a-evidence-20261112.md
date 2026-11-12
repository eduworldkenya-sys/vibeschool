# Grade 4 Mathematics — Whole Numbers 1.1(a), source-observation ledger

**State:** observed official-source text; **NOT an approved, imported or promoted KICD authority artifact**. This is a scoped handoff to the existing `curriculum_authority_*` and `vs_curriculum_*` gates, **not** a competing authority, a KICD endorsement, or a content-publication certificate.

## Source and exact locators

- Authority: Kenya Institute of Curriculum Development, *Grade 4 Mathematics Curriculum Design*, first published 2017, revised 2024.
- User-specified source: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf
- Scope: Strand **1.0 Numbers**, Sub-strand **1.1 Whole Numbers**, specific outcome **(a)** only.
- Printed p. 1 (PDF page index 9): specific learning outcomes, suggested experiences and two strand inquiry questions.
- Printed pp. 2–3 (PDF indices 10–11): continuation, core competency/values/PCIs. Some listed values and contemporary issues relate to *other* outcomes in 1.1, not automatically to (a).
- Printed p. 17 (PDF index 25): assessment rubric distinguishes correct place **and** total value at tens-of-thousands scope from demonstrating only one.
- Printed p. 50 (PDF index 58): suggested Whole Numbers apparatus, number charts and number cards.
- Upper-primary allocation: 5 Mathematics lessons/week (roman p. iv, PDF index 3). **Do not present** VibeSchool's 20 lessons for the whole 1.1 unit as an official per-sub-strand allocation; the user-specified source does not state it clearly.
- Retrieval evidence: text/PDF index read from KICD-hosted URL in a web tool. **Source bytes, immutable checksum, file storage locator, source approval, actor identity and authenticated snapshot were not available**. Do not generate or copy a guessed hash.

## Scoped paraphrase of KICD requirements (not reproduced source prose)

| Requirement | Observed official intent | Existing VibeSchool record / discrepancy | Status |
| --- | --- | --- | --- |
| Outcome 1.1(a) | Use position and total digit value through the tens-of-thousands column in everyday quantities. | `G4-MATH-1.1-a` UUID `28d19c48-f6a0-455f-b8b3-6c29081a52b0` is draft; `VS-G4-MA-1.1-01` UUID `c600f693-6242-45b3-b6f2-0211447e579c` is active but not source-verified. Same stable Whole Numbers sub-strand UUID `0f130af0-8f3c-433a-a0df-453927dece7f`. | OBSERVED_SEMANTIC_ALIGNMENT; CANONICAL_MATCH_BLOCKED |
| Learning experience | Learners work cooperatively with apparatus to identify positions of digits through ten-thousands and the numerical values those digits represent. | Original draft `VS-G04-MA-1.1-L01` models a five-digit number; older canonical draft chapter uses a four-column chart. | PARTIAL |
| Relevant inquiry | Why locating a digit's position matters to determining its value. | Catalog's VibeSchool-original alternate question discusses changes when moving a digit between positions. This is a helpful elaboration, not an exact approved source crosswalk. | PARTIAL |
| Competency | Critical thinking and problem solving using concrete place-value representations. | Catalog lists broad generic competencies; target-specific observation criteria need verification and linkage. | PARTIAL |
| Assessment | Demonstrate correct distinction between digit position and total value through ten-thousands, including real-world use; assess both, not one alone. | Two revealed worked examples in the existing draft were misflagged as assessment-eligible. Target-linked bank and revision/reassessment remain absent. | MISSING |
| Resources/access | Place-value apparatus, charts, number cards; collaborative and accessible demonstrations. | Canonical Visual Learning Library exists, but no certified five-column visual for this sub-strand. | MISSING |
| Scheme | A teacher may distribute these experiences across the five weekly Mathematics slots. | Three existing teacher-owned Whole Numbers Scheme rows have no exact outcome ID; their topics include up to 100,000 / 1,000,000. They must be reviewed without overwriting ownership/history. | NOT_CONNECTED |

## Identity preservation and authorized reconciliation

1. Do not rename, delete or merge `G4-MATH-1.1-a`, `VS-G4-MA-1.1-01` or any existing Scheme/lesson record. Do not infer an official verified source from a similar heading.
2. Through the existing authenticated owner `curriculum_authority_register_source` and allowlisted `curriculum-authority-intake` workflow, fetch actual official artifact bytes, record the source revision and exact SHA-256, stage *actual* source observations with source locators, seal/reconcile the immutable snapshot, resolve hierarchy, obtain owner review and authorized promotion. Do not use privileged SQL as a substitute for the authenticated owner session.
3. Establish the existing `vs_curriculum_package_scopes`, `vs_curriculum_source_requirements`, `vs_curriculum_manuscript_aliases` and `vs_curriculum_alias_outcomes` crosswalk through its own governed P0 source-to-database process (not an extra table). Explicitly identify `VS-G04-MA-1.1-L01` as a *manuscript alias*, not a UUID.
4. Read back the exact outcome state and source locator and require `vs_curriculum_package_gate(package_id).state='PASS'` before content certification. A source registry row, unapproved draft outcome, editor's comparison or this ledger cannot alone establish `CURRICULUM_MATCH`.
5. Keep authentic Grade 4 Mathematics source edition(s) distinct. Do not silently substitute a different KICD PDF URL or assume a different unit allocation from another edition.

## Existing reuse targets; no duplicate infrastructure

- Draft publication `2745c031-65be-47de-bd75-1e1db74d4123`.
- Draft chapter `f95c252a-da2d-477c-b4cb-33b5f8338e10`: repair four-digit-only model to include five-column tens-of-thousands instruction **after** authority gate passes.
- Editorial packet `content/curriculum/production/grade4-original-first-lessons.v1.json`, key `VS-G04-MA-1.1-L01`; `specificOutcomeCrosswalk='pending'` remains truthful until approved reconciliation.
- Visual intake `POST /api/operator/visual-library` is already implemented with scoped bearer token and private-candidate-only rights. The current chat connector does not expose that token or a direct authenticated binary upload operation.
- Canonical publication/chapters/blocks, `learning_resources` / `learning_resource_versions`, `teaching_resource_links`, `scheme_lesson_resource_links`, `assessment_questions`, and `assessment_item_outcomes` remain the only intended authorities.

**Publication state:** blocked. **Learner study/mastery:** no evidence. **Independent reviewer:** not represented by this document.
