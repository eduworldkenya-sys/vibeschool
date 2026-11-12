# Grade 9 Mathematics — Hierarchy Reconciliation (candidate only)

## Evidence status

- Source recorded in VibeSchool: **KICD Mathematics Grade 9 — July 2024 Revised**, source ID `97193d03-7eda-4124-93b1-1a3840647ca3`.
- Candidate hierarchy extracted from the public KICD 2024 April-formatted Grade 9 Mathematics design: https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-9-Design-Formatted-April-2024.pdf
- The registered July 2024 source is linked from KICD's official Grade Nine curriculum page, but its complete document must be reviewed before treating this candidate as authoritative for July.
- This is **not** a verified curriculum snapshot and has **not** been promoted to production curriculum tables.

## Live comparison — 9 November 2026

| Metric | Value |
|---|---:|
| Reference strands | 5 |
| Reference sub-strands | 19 |
| Existing local Grade 9 Mathematics sub-strand rows | 20 |
| Exact strand + sub-strand matches (normalised case and punctuation) | 2 |
| Reference entries with no exact local match | 17 |
| Existing local entries with no exact reference match | 18 |
| Approved source records | 1 |
| Promoted curriculum snapshots | 0 |
| Approved Grade 9 Mathematics blueprints | 0 |
| Explicitly verified official learning outcomes linked to this subject | 0 |

Exact matched entries: **Numbers / Integers** and **Data Handling and Probability / Probability**.

Examples of mismatches:
- Local `Measurement / Area` vs reference `Measurements / Area` — a *strand-name discrepancy*, not proof of a missing mathematical concept.
- Local `Numbers / Fractions`, `Numbers / Whole Numbers` — generic/prerequisite content not corresponding to the reference Grade 9-specific sub-strand names.
- Reference `Algebra / Matrices`, `Algebra / Linear Inequalities`, `Geometry / Trigonometry` — not represented with exact sub-strand names in the local canonical hierarchy.

## Required reconciliation sequence

1. Verify the entire July 2024 revised document from the registered official source, including strand names, sub-strand numbering and specific learning outcomes.
2. Compare the verified July hierarchy to the staged `content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json`.
3. Use the established `curriculum_authority` artifact, observations, hierarchy-binding, reconciliation and owner-promotion flow. Do not overwrite existing `cbc_strands` IDs or published assessment references.
4. Resolve naming differences and missing exact hierarchy entries through a reviewed, idempotent migration with compatibility aliases or mappings if necessary.
5. Promote source-grounded outcomes with provenance, then independently verify outcome status before claiming curriculum-certified exams.
6. Reconcile existing pilot questions against official outcomes. Classify non-matching questions as prerequisite/revision content instead of deleting history.
7. Create an outcome-based exam blueprint and enforce a distinct curriculum-verified publication gate.

No official learning-outcome text is reproduced in this candidate manifest. Existing 2026 assessment attempts and published papers remain unchanged.

## Read-only live recheck — 12 November 2026

**Mission:** begin VibeSchool Grade 9 Mathematics curriculum development while preserving KICD's factual curriculum structure and intents. The requested close alignment must **not** mean duplicating copyright-protected official text, inventing learning outcomes, or calling a draft KICD-approved.

### Official sources and edition boundary

- KICD Grade Nine designs, Mathematics July 2024 Revised: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ ; official embedded file https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview .
- Accessible earlier official KICD Mathematics Grade 9 April-formatted PDF: https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-9-Design-Formatted-April-2024.pdf .
- April source locator: printed page **vii** lists five Mathematics lessons per week at 40 minutes each; printed page **x** lists 5 strands, 19 sub-strands and 150 **suggested** lessons. Those are **April source facts**, not verified July allocations.
- The earlier PDF contains internal lesson-number discrepancies: **1.2 Cubes and Cube Roots** summary 6 versus detail 5 (printed p. 3); **1.3 Indices and Logarithms** summary 8 versus detail 6 (printed p. 5); **1.4 Compound Proportions and Rates of Work** summary 9 versus detail 12 (printed p. 6). Confirm against authoritative July revision and distinguish summary counts from explanatory-page counts; do not silently select a number.
- The complete **July 2024 official PDF bytes were not accessible for authenticated artifact intake** during this check. No SHA-256, immutable artifact, staged July observations, promoted snapshot, or source-to-outcome certification was manufactured. Access to a third-party OCR mirror is not a substitute for actual official KICD artifact verification.

### Existing production data (read-only, 12 November)

- 20 canonical `public.cbc_strands` rows for Grade 9 Mathematics, with **zero populated** learning-outcome / inquiry / suggested-experience arrays.
- Exactly matching pairs observed against the April reference hierarchy: `Numbers / Integers` (existing UUID `2c590eb4-c69e-4412-8827-ef44cd300691`) and `Data Handling and Probability / Probability` (UUID `af9de857-3046-4053-9914-0d1c7f500fdf`).
- 17 of the 19 required April-reference entries lack an exact name pair in the live hierarchy. Name mismatches alone do **not** establish missing mathematical skills (e.g. `Measurement / Area` vs `Measurements / Area`). Legacy headings may reflect other grades or prerequisites, and **must not** be deleted.
- `public.curriculum_learning_outcomes`: zero records linked to Grade 9 Mathematics canonical sub-strands; zero verified outcomes in that scope.
- Registered July 2024 Mathematics `curriculum_authority_sources` record exists and is approved, but **zero artifacts, zero snapshots and zero promoted outcomes** were found linked to it. Approval of a source registry row is not approval of its learning outcomes.
- No Grade 9 rows in `scheme_of_work` were found; do not invent teacher schemes or tie the curriculum to arbitrary school weeks.

### Scoped repository work and non-effects

1. Extend **existing** `content/curriculum/grade9-mathematics-hierarchy-2024-candidate.json` with the complete observed April summary table, lesson guidance, primary publisher URL, access date and discrepancy ledger. Keep its **candidate** status and the registered July source identity unchanged.
2. Add regression test `scripts/tests/grade9-mathematics-source-summary.test.mjs` requiring exact hierarchy, 19 units, total 150 summary lessons and fail-closed July approval state.
3. **No new curriculum tables, duplicate import pathways, unapproved source hashes, changed canonical curriculum IDs, teacher-scheme mutation, database write, content publication or learner release.**

### Gate and continuation

**KICD ↔ VibeSchool — Grade 9 Mathematics: 2 of 19 exact April *heading* pairs; 0 independently verified July learning outcomes; BLOCKED_CURRICULUM_RECONCILIATION for content generation and publication.**

Next: obtain July original bytes through the existing authenticated `curriculum_authority_*` intake; independently verify all strands, sub-strands, specific learning outcomes, inquiry, learning experiences, competencies, values, PCIs, assessment rubrics and lesson allocations with section/page locators. Reconcile into existing canonical identities, retaining history, then author VibeSchool-original learner + teacher + assessment + revision packages outcome by outcome under `docs/curriculum/CONTENT_GENERATION.md`. Do not present this candidate as the live curriculum.
