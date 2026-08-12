# TBL-013 provenance batch 003 — Content / Reader

Read-only provenance classification captured on 2026-08-12 for the frozen TBL-013 production-ledger snapshot documented in `TBL013_PRODUCTION_LEDGER_SNAPSHOT_20260812.md`.

## Method

Repository migration SQL and production-ledger statement bodies were canonicalized with the calibrated TBL-013 algorithm: remove block comments, remove line comments, remove insignificant whitespace, lowercase the remaining SQL, then SHA-256 hash the canonical byte sequence.

No production DDL, DML, migration repair, or ledger mutation was executed.

## Result

- Repository migrations sampled in Content/Reader families: 49
- Same-name/different-version pairs found: 19
- Exact canonical SQL-body matches: **10**
- Same-name changed-body pairs: **9**
- Additional one-sided records resolved by exact-body timestamp equivalence: **20**
- Authorized production repairs: **0**

The 10 exact-body pairs are classified `PROVEN_TIMESTAMP_REMAP_EXACT_BODY` and require no production ledger repair.

The following changed-body cases remain `SAME_NAME_CHANGED_BODY_REQUIRES_FINAL_STATE_PROOF`:

- `ce_003_structured_content_blocks`
- `ce_004_learning_outcomes_curriculum_links`
- `ce_005_unified_learning_resource_registry`
- `ce_006_publication_vibelearn_reconciliation`
- `ce_007_teacher_adoption_school_libraries`
- `ce_009_010b_assignment_authority_delivery`
- `ce_011b_016_content_engine_hardening`
- `read008c_learner_assigned_reading_delivery`
- `reader_question_answer_redaction`

A body mismatch is not treated as a defect. These entries remain blocked until dependency/final-state mutation equivalence is proven.

## Running TBL-013 reconciliation count

- Original one-sided records: 575
- Resolved by exact-body timestamp equivalence in batch 001: 52
- Resolved by exact-body timestamp equivalence in batch 002: 24
- Resolved by exact-body timestamp equivalence in batch 003: 20
- Total resolved by this evidence layer: **96**
- Maximum remaining unresolved after these three batches: **479**

No production repair is authorized by this batch.
