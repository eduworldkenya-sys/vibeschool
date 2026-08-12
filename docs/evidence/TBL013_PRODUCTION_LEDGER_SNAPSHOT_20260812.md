# TBL-013 production migration-ledger reconciliation snapshot

Captured read-only on 2026-08-12 against Supabase project `yauqsxggtuxuykcbrtzf` and certified repository head `929d49f73c9148e149c5c9bf0a5b201710a2e900`.

## Repository inventory

- Migration files: 418
- Distinct migration versions: 418
- Duplicate versions: 0
- Invalid migration filenames: 0
- Filename inventory SHA-256: `be2b4c317dba6cb7b8d5111975d1c0c826b8883a9cfc8be453eab115f4c267b3`
- GitHub Actions evidence run: `31587432167`
- Artifact digest: `sha256:0c5b03583955198d3fe6f13ecfe316266fba096c632350a3a4b1a8d2ac27f95e`

## Production ledger snapshot

The production ledger was queried through the read-only Supabase connector. No DDL, DML, migration repair, or ledger write was executed.

- Production rows: 627
- Distinct production versions: 627
- Duplicate production versions: 0
- Latest production version in this snapshot: `20260812102536`
- Full production-ledger statement SHA-256: `a8d9a3bc95da166a16a9282a717708832ea213875dcfdcd8c7650113bf99932a`

The SHA-256 is calculated over each production ledger row ordered by version using `version|name|statements`. It identifies the exact production history snapshot used for this reconciliation even if later migrations are appended.

## Version-set reconciliation

- Repository versions: 418
- Production versions: 627
- Exact version matches: 235
- Repository-only versions: 183
- Production-only versions: 392
- Duplicate versions: 0 on both sides
- Authorized migration repairs: **0**

Status: `REQUIRES_PROVENANCE_CLASSIFICATION`

A one-sided version is historical evidence, not a migration-repair instruction. Production-only versions may be legitimate historical, baseline, preview-to-production, or out-of-band entries. Repository-only versions may be recovery/reconstruction representations. No `applied` or `reverted` status may be inferred from set membership alone.

## Canonical SQL fingerprint calibration

Repository migration SQL was canonicalized by removing block comments, line comments and insignificant whitespace, lower-casing the remaining SQL, and hashing the resulting byte sequence with SHA-256. Production ledger statement bodies were canonicalized by the same algorithm.

Three exact-version controls reproduced the repository fingerprint exactly, including `20260723191034_vibelearn_publication_sync`, `20260805084242_exq_004b1_lesson_assessment_authority`, and `20260806164150_vibelearn_011_fix_exam_readiness_assessment_authority`. This proves the production ledger retains sufficient statement-body fidelity for conservative body-equivalence classification.

Repository SQL fingerprint artifact:

- GitHub Actions run: `31588146876`
- Artifact: `tbl013-sql-fingerprints-31588146876`
- Artifact digest: `sha256:21b5d57b2d011c34cc701f38710e70f989d08f13f96abb115dc4efc5c19a1a2a`
- Fingerprinted migrations: 418

## Provenance batch 1 — EXQ / Student Task / Homework / VibeLearn timestamp remaps

Thirty-seven same-name repository/production pairs with different versions were compared at canonical SQL-body level.

- Timestamp-remap pairs tested: 37
- Exact canonical SQL-body matches: **26**
- Same-name changed-body pairs: **11**
- One-sided records resolved by exact-body timestamp equivalence: **52**
- Automatic production repairs authorized: **0**

The 26 exact-body pairs are classified `PROVEN_TIMESTAMP_REMAP_EXACT_BODY`. Their different ledger versions do not represent different mutations and must not trigger migration repair merely to equalize timestamps.

The changed-body cases remain `SAME_NAME_CHANGED_BODY_REQUIRES_FINAL_STATE_PROOF`:

- `exq_003b_teacher_assessment_analytics`
- `exq_006c_marking_moderation_audit`
- `exq_007a_outcome_question_intelligence`
- `exq_007b_learner_intervention_intelligence`
- `exq_008b_evidence_snapshot_generation` (two repository representations map to the historical production name)
- `exq_008d_report_validation_and_audit`
- `exq_008e_parent_learner_longitudinal_delivery`
- `student_task_002_healthy_motivation_progress`
- `student_task_004a_universal_task_launch_authority`
- `vibelearn_009_form4_revision_workspace`

A changed body is not automatically a defect. It may be a replay-safe reconstruction, a corrected repository representation, or genuine divergence. These cases require dependency/final-state mutation-equivalence evidence before classification.

After this first proven-body batch, at most **523** of the original 575 one-sided records remain unresolved by this evidence layer.

## Provenance batch 2 — HQ / Engine timestamp remaps

Sixty repository migrations in the `hq_` and `engine_` families were fingerprinted against production. Twenty-seven had the same migration name under a different production version.

- Same-name/different-version pairs tested: 27
- Exact canonical SQL-body matches: **12**
- Same-name changed-body pairs: **15**
- Additional one-sided records resolved by exact-body timestamp equivalence: **24**
- Automatic production repairs authorized: **0**

The 12 exact-body pairs are classified `PROVEN_TIMESTAMP_REMAP_EXACT_BODY`.

The 15 changed-body cases remain blocked for final-state proof:

- `hq_authority_contract_v1`
- `hq_billing_authority_enforcement_v1`
- `hq_company_authority_phase2`
- `hq_decision_authority_integration`
- `hq_defense_in_depth_privilege_hardening`
- `hq_emergency_override_fix_v1`
- `hq_enterprise_org_v2`
- `hq_operating_system_v1`
- `hq_operational_hardening_10of10`
- `hq_policy_helper_lockdown_v1`
- `hq_policy_registry_api_v1`
- `hq_policy_session_and_rollback_v1`
- `hq_product_authority_guard_v1`
- `hq_product_policy_enforcement_v1`
- `hq_proof_of_control_v1`

After batches 1 and 2, **76** one-sided records are resolved by exact-body timestamp equivalence, reducing the unresolved ceiling from 575 to **499**. Changed-body cases are not counted as resolved.

## Confirmed recovery provenance already established

The PR #68 recovery work established several deliberate historical representations. For example:

- Repository `20260722163600_tbl010d_subject_identity_invariant.sql` replaces the redundant historical `20260722163605_tbl010d_subject_identity_invariant` collision that prevented blank replay. The production ledger retains `20260722163605` as historical evidence; no production repair is authorized from that difference.
- Repository `20260805120000_exq_008a_report_card_authority.sql` and `20260805120001_exq_008b_evidence_snapshot_generation.sql` are replay-safe recovered representations of the historical EXQ-008A/EXQ-008B mutations. Production retains its historical migration versions; repository recovery must not rewrite the production ledger merely to make timestamps equal.
- The restored HQ predecessor versions `20260809051816_hq_operating_system_v1` and `20260809053527_hq_digital_workforce_v1` are represented under matching production versions and therefore fall inside the 235 exact-version matches.

## Safety conclusion

TBL-013 has proven that the problem is not duplicate production migration versions. The remaining work is provenance and mutation-equivalence classification of the still-unresolved one-sided history.

Production migration history remains untouched. Any future production ledger repair requires explicit evidence for the individual version and separate authorization. Numerical parity is not itself a valid reason to mutate production history.
