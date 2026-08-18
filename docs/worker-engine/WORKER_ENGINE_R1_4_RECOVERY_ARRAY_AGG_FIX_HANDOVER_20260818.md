# Worker Engine R1.4 recovery catalog-scan repair handover — 2026-08-18

## Scope

This handover records the post-merge repair required after PR #246 (`fix(worker-engine): converge historical R1.3X production lineage`) merged as `8b8f1ffc38a9f13a5c83e6ac29bac59d6dd64a51`.

No production mutation is authorized by this branch. Vercel is out of scope. Worker Engine activation is out of scope.

## Failure observed

The exact PR #246 head passed the normal Worker Engine, migration-security, clean-rebuild and production-build gates, but the dedicated `Worker Engine WE-R1.4 Production Recovery` rehearsal failed in its disposable database during `Late-backfill canonical Worker Engine lineage`.

Failure:

```text
20260815090500_worker_engine_we_r1_3x_historical_lineage_convergence.sql:137:
ERROR: "array_agg" is an aggregate function
CONTEXT: PL/pgSQL function inline_code_block line 4 at FOR over SELECT rows
```

The protected production job was skipped, so production was not mutated.

## Root cause

`pg_proc` contains multiple routine kinds, including normal functions, procedures, aggregates and window functions. The lineage quarantine query called `pg_get_functiondef(p.oid)` while scanning the complete `public` namespace. PostgreSQL therefore attempted to reconstruct the definition of an aggregate such as `array_agg`, which `pg_get_functiondef()` does not support.

A simple boolean predicate beside the definition call is not considered a sufficient safety boundary because SQL expression evaluation order is optimizer-controlled. The repair therefore separates candidate selection from definition inspection.

## Repair

Branch: `fix/worker-engine-r14-production-recovery-array-agg`

Changed migration:

`supabase/migrations/20260815090500_worker_engine_we_r1_3x_historical_lineage_convergence.sql`

The function quarantine now:

1. selects only `public.pg_proc` entries with `prokind='f'`;
2. iterates those ordinary-function OIDs in PL/pgSQL;
3. calls `pg_get_functiondef()` only after the catalog-kind boundary has been established;
4. applies the existing exact-identifier dependency regexes to the reconstructed definition;
5. quarantines only matching legacy functions;
6. preserves all existing fail-closed table fingerprints, archival behavior, grants and runtime-off invariants.

No production data mapping, ontology, Worker Engine authority, activation state or migration ordering changed.

## Verification contract

The existing `.github/workflows/worker-engine-we-r1-4-production-recovery.yml` is the authoritative regression proof because changing the convergence migration triggers it on pull requests. It must reconstruct the historical production overlay in a disposable Supabase database, apply the canonical recovery chain, verify archived and canonical evidence, run the R1.4 production-closure adversarial suite, and retain the engine in the fail-closed state.

Promotion is forbidden until that exact-head workflow and the ordinary repository certification gates are green.

## Production boundary

After merge, the protected recovery workflow may proceed only if its disposable certification succeeds. The production job remains guarded by the `production-migration-repair` environment, exact project reference, linked migration ledger, exact dry-run plan, post-apply ledger verification and zero-pending postflight.

Expected engine state remains:

- heartbeat OFF;
- Factory OFF;
- runtime execution OFF;
- autonomy L0;
- maximum risk 0;
- Shadow OFF;
- Shadow scheduler OFF;
- global stop ON.

Only after production recovery and verification may the programme advance to Shadow Trial, bounded canary, and Content Factory remediation.