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

## Confirmed recovery provenance already established

The PR #68 recovery work established several deliberate historical representations. For example:

- Repository `20260722163600_tbl010d_subject_identity_invariant.sql` replaces the redundant historical `20260722163605_tbl010d_subject_identity_invariant` collision that prevented blank replay. The production ledger retains `20260722163605` as historical evidence; no production repair is authorized from that difference.
- Repository `20260805120000_exq_008a_report_card_authority.sql` and `20260805120001_exq_008b_evidence_snapshot_generation.sql` are replay-safe recovered representations of the historical EXQ-008A/EXQ-008B mutations. Production retains its historical migration versions; repository recovery must not rewrite the production ledger merely to make timestamps equal.
- The restored HQ predecessor versions `20260809051816_hq_operating_system_v1` and `20260809053527_hq_digital_workforce_v1` are represented under matching production versions and therefore fall inside the 235 exact-version matches.

## Safety conclusion

TBL-013 has proven that the problem is not duplicate production migration versions. The remaining work is provenance and mutation-equivalence classification of the 575 one-sided version records (183 repository-only + 392 production-only).

Production migration history remains untouched. Any future production ledger repair requires explicit evidence for the individual version and separate authorization. Numerical parity is not itself a valid reason to mutate production history.
