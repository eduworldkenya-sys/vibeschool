# Grade 9 Mathematics — KICD source to existing Scheme crosswalk (13 November 2026)

**Scope:** Mathematics only. This is a reproducible **read-only reconciliation baseline**, not a whole-document source transcript, curriculum approval, teacher Scheme save, or learner release.

## Verified starting position

- Official source catalogue: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/ (Mathematics → registered July 2024 revision).
- The registered official July source is `https://drive.google.com/file/d/1HgntYl8nS1zydy8k00KrjEt_zJiMqISL/preview`. Its file bytes and SHA-256 were **not** captured through the authorised curriculum-artifact pipeline.
- The KICD-authored July 2024 PDF copy hosted at `https://easylearn.co.ke/images/document/11752376/Mathematics-Grade-9-July-2024-Revised.pdf` was inspected at the **printed page xii summary** for structural facts only. Treat this as *secondary corroboration*, not the original stored source file. The official KICD April-formatted PDF independently provides the same 5 strands / 19 sub-strands / 150 suggested lessons at printed p. x: `https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-9-Design-Formatted-April-2024.pdf`.
- Weekly allocation: 5 Mathematics periods, 40 minutes each. The suggested 150 lessons are **not** an instruction to fabricate school/teacher weeks.
- Production `public.cbc_strands` contains 20 Grade 9 Mathematics **legacy** units; exactly two strand+sub-strand pairs match the reference hierarchy, `Numbers / Integers` and `Data Handling and Probability / Probability`. A third title-only candidate `Area` differs by `Measurement` versus `Measurements`. None of these proves a verified outcome mapping.
- Production `curriculum_learning_outcomes`: **0** linked Grade 9 Mathematics outcomes (and therefore 0 verified). Production `scheme_of_work`: **0** Grade 9 saved rows. Registered July source: **0** linked artifacts, **0** snapshots.

## Executable starting asset

- `content/curriculum/grade9-mathematics-scheme-crosswalk-20261113.json`: one machine-checkable candidate row for **each of the 19 source-summary units**, with code, strand, title, summary lesson count, matching legacy UUID **only** where exact, title-only alias candidates kept separate, and a fail-closed Scheme connection status.
- `scripts/tests/grade9-mathematics-crosswalk.test.mjs`: verifies 19 units, 150 lesson summary, 2 exact UUIDs, 1 alias candidate, no false approval and no constructed Scheme links.
- Reuses the existing `curriculum_authority_*`, `cbc_strands`, `curriculum_learning_outcomes`, `scheme_of_work`, `scheme_lesson_outcomes`, and `commit_mapped_scheme_lesson` contracts. No new table, engine, scheduling task, service role, public full-text copy, or artificial teacher Scheme row was introduced.

## Next material production steps, in order

1. Acquire the officially registered July 2024 PDF through the *existing authenticated intake*, record permitted rights handling, immutable artifact/hash and a page-by-page source inventory. Compare the 19 summary entries with the full document, including details whose lesson counts differ from summary.
2. Reconcile all source-exact units and individual outcomes, experiences, inquiries, rubric data and appendix requirements into the established restricted authority/observation/reconciliation pipeline. Do **not** mistake a candidate title match for official source verification or use a public GitHub full-text dump for private transcription.
3. Review source-to-canonical hierarchy mappings; preserve the existing 20 legacy IDs and other assessment history. Establish verified atomic `curriculum_learning_outcomes` records against legitimate source evidence.
4. After those outcome IDs exist, use the established **teacher-invoker** `commit_mapped_scheme_lesson` flow for the actual selected academic term/week/class. Check `scheme_of_work.curriculum_outcome_id` and `scheme_lesson_outcomes` by persisted readback. Never create synthetic teacher class assignments or imply a preview is a saved Scheme.
5. Re-run teacher signed-in Curriculum Map → Scheme selection → Save → Reopen, plus negative paths. Only then mark the **specific tested subject scope** linked.

**Current state:** `SOURCE_SUMMARY_DISCOVERED`; `LEGACY_CROSSWALK_RECORDED`; `OFFICIAL_ARTIFACT_MISSING`; `OUTCOMES_NOT_CONNECTED`; `SCHEME_NOT_CONNECTED`; `PUBLICATION_NOT_PERFORMED`. The owner's assertion of private copying permission is recorded in `COPY_KICD_CURRICULUM.md`; this file does not certify its legal scope.
