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

## KICD canary evidence

The first canary is intentionally narrow: Grade 9 Mathematics.

Official authority page:

- `https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/`

KICD embeds the source document titled `Mathematics Grade 9 - July 2024 - Revised.pdf` from Google Drive with file id `1HgntYl8nS1zydy8k00KrjEt_zJiMqISL`.

The production canary has not been registered or promoted yet. Artifact bytes and SHA-256 must be retained first, and source registration/final promotion must execute under a legitimate HQ-owner session. Administrative SQL must not impersonate that owner boundary.

## Operator control-plane closure

Branch `ops/curriculum-authority-production-handover-20260818` now adds the missing production operator lane without weakening authority separation:

- `/hq/curriculum-authority` uses the isolated HQ Supabase session.
- owner registers the authoritative source through `curriculum_authority_register_source`;
- `curriculum-authority-intake` verifies the caller is a platform owner before service work;
- artifact fetch is host allow-listed to KICD/Google delivery infrastructure;
- redirects are revalidated;
- artifact size is capped at 30 MiB;
- the response must have PDF magic bytes;
- SHA-256 is computed from artifact bytes;
- artifact bytes are retained in private bucket `curriculum-authority-artifacts`;
- immutable artifact and staging snapshot are created through canonical service RPCs;
- exact source observations are staged through canonical RPCs;
- service lane may seal/reconcile but cannot bind hierarchy or promote outcomes;
- hierarchy binding remains an authenticated HQ-owner RPC;
- fresh reconciliation remains mandatory after binding;
- final promotion remains an authenticated HQ-owner RPC and requires the operator to type `PROMOTE OFFICIAL`.

Dedicated static contract: `scripts/test-curriculum-authority-operator.mjs`.
Dedicated CI: `.github/workflows/curriculum-authority-operator-contract.yml`.

The operator branch remains isolated until all exact-head gates are green. Do not trigger Vercel intentionally before certification is complete.

## Next controlled operation

1. Certify the operator branch against current `main`.
2. Merge only when exact-head gates are green.
3. Apply `20260818133000_curriculum_authority_operator_intake_v1.sql` and deploy `curriculum-authority-intake`.
4. Verify the private artifact bucket and owner/service boundary in production.
5. Use a legitimate HQ-owner session to register the Grade 9 Mathematics KICD canary source.
6. Fetch/hash/store the exact artifact and record its SHA-256.
7. Stage exact source observations only; never infer missing source text.
8. Seal and reconcile.
9. Review conflicts/missing hierarchy in HQ.
10. Bind exact hierarchy.
11. Force fresh reconciliation.
12. Promote only after explicit owner confirmation.
13. Verify source lineage, outcome identity, zero pacing leakage, and rollback/recovery evidence before expanding scope.

Do not bulk-promote Grade 9 or other curriculum merely because matching `cbc_strands` rows already exist. Existing row presence is not authoritative provenance.
