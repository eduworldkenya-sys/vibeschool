# L0 Production Ledger Snapshot — 2026-08-10

## Status

- Worker Engine implementation: **BLOCKED**
- L0: **RED**
- Production schema writes performed by this investigation: **NONE**
- Purpose: establish a fresh production-side migration reference before any baseline or reconciliation decision.

## Production project

- Supabase project ref: `yauqsxggtuxuykcbrtzf`
- Environment classification: production

## Migration ledger

Read-only query of `supabase_migrations.schema_migrations` on 2026-08-10 returned:

- Total applied migration rows: **552**
- First version: `20260520000000`
- Latest version: `20260810111940`

Latest recorded versions include:

- `20260810111940` — `fix_data_api_product_gate_execute_permissions`
- `20260810090223` — `harden_get_my_role_fallback`
- `20260810071216` — `security_policyless_hq_service_only_grants`
- `20260810065903` — `fix_classroom_brief_attendance_enum`
- `20260810065741` — `classroom_learning_loop_projections`
- `20260810063819` — `hq_workroom_foreign_key_indexes`
- `20260810043746` — `security_explicit_grants_contract`
- `20260810040216` — `issue_41_split_vibetextbook_reader_security`
- `20260810035424` — `hq_workroom_production`

## Consequence for L0

Previously recorded migration counts must not be reused as current truth. The production ledger has advanced to 552 rows. A fresh repository-versus-production comparison is therefore required before choosing a baseline strategy.

In particular, do **not** infer that a `000_baseline.sql` is already justified from the earlier 546/339 comparison. The correct sequence is:

1. obtain the current repository migration inventory for the target branch;
2. compare version keys against the 552 production ledger rows;
3. classify live-only, repo-only, exact-match, name-mismatch, duplicate, synthetic-baseline, and pending-deployment cases;
4. separately compare the actual catalog structure;
5. only then determine the reconstruction/baseline mechanism.

## Safety decision

No production migration ledger row is to be deleted, renamed, or rewritten as part of this investigation. No production data belongs in a foundation migration. No Worker Engine tables are authorized while L0 remains RED.

## Next evidence gate

The next L0 artifact is the **fresh migration parity manifest**. It must be generated from the current repository state and the current 552-row production ledger. Baseline SQL remains unauthorized until that manifest and the structural schema comparison are reviewed.
