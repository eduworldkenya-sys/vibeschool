# Curriculum Authority production commissioning handover — 2026-08-18

## Scope

Production commissioning of the curriculum-authority capability merged through PR #226 and PR #228.

## Repository authority

- PR #226 merged as `0025406f89fe9273a84501df75d5f5d3590a3dd8`.
- PR #228 merged as `22fdac66efb33f249628fb7c5fe40d6205d7d7cc` after exact-head certification.
- Canonical repository migrations:
  - `20260818125000_curriculum_authority_source_pipeline_v1.sql`
  - `20260818130000_curriculum_authority_hierarchy_binding_v1.sql`

## Production application

Supabase project: `yauqsxggtuxuykcbrtzf`.

Both curriculum-authority migrations were applied successfully to production. The migration API initially recorded generated timestamp versions; the history table was then repaired to the canonical repository versions after verifying the schema had applied successfully.

Production migration ledger now contains, in order:

- `20260818111900 worker_engine_we_r1_3x_production_reconciliation_bridge`
- `20260818125000 curriculum_authority_source_pipeline_v1`
- `20260818130000 curriculum_authority_hierarchy_binding_v1`

## Live verification

Verified after application:

- Seven `curriculum_authority_*` tables exist.
- RLS is enabled on every authority table.
- `anon` and `authenticated` cannot directly SELECT or INSERT raw authority evidence tables.
- `service_role` retains the required authority-table access.
- Source registration is authenticated/HQ-owner gated; anonymous execution is denied.
- Reconciliation is service-only.
- Promotion is authenticated/HQ-owner gated; anonymous execution is denied.
- Hierarchy binding is authenticated/HQ-owner gated; anonymous execution is denied.
- Installation seeded zero sources, artifacts, snapshots, observations, reconciliations, promotions, or hierarchy bindings.
- Grade 9 remains 144 `cbc_strands` rows, all unpaced and with zero `source_ref` claims.

## Safety state

Production has the authority machinery but contains no official KICD authority claims created by this commissioning. No term/week pacing was invented. No Grade 9 hierarchy was source-bound. No curriculum outcome was promoted.

## Next controlled operation

The next step is a single authoritative-source canary:

1. Select one genuine KICD source for one canonical subject/grade scope.
2. Preserve the immutable source artifact and SHA-256.
3. Stage normalized observations through the service lane.
4. Seal and reconcile.
5. Review conflicts/missing hierarchy through HQ.
6. Bind the exact hierarchy.
7. Force fresh reconciliation.
8. Promote only after owner approval.
9. Verify source lineage, outcome identity, zero pacing leakage, and rollback/recovery evidence before expanding scope.

Do not bulk-promote Grade 9 or other curriculum merely because matching `cbc_strands` rows already exist. Existing row presence is not authoritative provenance.
