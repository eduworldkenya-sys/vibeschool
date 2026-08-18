# Content Engine Gate 1 Production Parity Handover — 2026-08-18

## Mission

Close the repository-to-production schema parity prerequisite for VibeSchool Content Engine R1/R2.1/R2.2 without activating autonomous execution, paid model authority, publication authority, Worker Engine runtime, Factory or Shadow.

Repository: `eduworldkenya-sys/vibeschool`

Branch: `agent/content-engine-gate1-production-parity-20260818`

Base: `8b8f1ffc38a9f13a5c83e6ac29bac59d6dd64a51` (`main`, after PR #246 historical Worker Engine lineage convergence)

Production Supabase: `yauqsxggtuxuykcbrtzf`

No Vercel tool/deployment was intentionally invoked during this work.

## Live production findings

Read-only verification after PR #246 showed that production has materially advanced beyond the earlier Content Engine audit snapshot.

### Worker Engine prerequisite is now present

The production migration ledger contains the canonical historical-lineage convergence and R1.4 recovery sequence, including:

- `20260815090500_worker_engine_we_r1_3x_historical_lineage_convergence`
- canonical X3/X4+ Worker Engine migrations
- `20260815092500_worker_engine_we_r1_3x_historical_lineage_data_bridge`
- `20260815121500_worker_engine_we_r1_4_capability_authority`
- `20260815123000` through the R1.4 consequential execution chain
- `20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge`

The canonical `public.hq_workforce_capability_authority_grants` relation exists.

Active capability-authority grants observed: **0**.

### Runtime remains correctly fail-closed

Observed singleton state:

- heartbeat: OFF
- Factory: OFF
- runtime execution: OFF
- runtime autonomy: L0
- runtime max risk: 0
- Shadow: OFF
- Shadow scheduler: OFF
- Shadow global stop: ON

This is the required state for non-activating Content Engine schema promotion.

## Exact Content Engine production gap

The following seven repository-certified versions are absent from the live migration ledger:

1. `20260818114500_content_factory_throughput_closure`
2. `20260818130850_curriculum_intelligence_sources_repository_parity`
3. `20260818130900_curriculum_research_queue_repository_parity`
4. `20260818131000_content_factory_r2_research_worker_bridge`
5. `20260818131100_content_factory_r2_research_evidence_trust_hardening`
6. `20260818131200_content_factory_r2_semantic_verifier`
7. `20260818131210_content_factory_r2_semantic_material_binding`

Live relations already include the historical `curriculum_research_jobs` and `curriculum_intelligence_sources` operational objects, while the R2.2 immutable semantic material/verdict relations are not yet present. This is exactly the mixed history that the repository-parity migrations are designed to reconcile.

## Safety architecture

Gate 1 does **schema parity only**.

It must not:

- enable Worker Engine runtime;
- enable heartbeat or Factory;
- enable Shadow or its scheduler;
- create active capability-authority grants;
- deploy the R2.1 Research Worker Edge Function;
- deploy the R2.2 Semantic Verifier Edge Function;
- configure Groq/Tavily/model secrets;
- authorize paid AI;
- grant publication/release authority;
- run a real research/semantic-verification job;
- weaken release or evidence gates.

## Protected promotion path added

### `.github/workflows/content-engine-gate1-production-parity.yml`

Adds a protected production migration workflow with:

- exact seven-version allowlist;
- pull-request validation only;
- production apply only on `main` push of the promotion workflow or an explicit confirmed manual dispatch;
- `production-migration-repair` environment;
- exact project-ref assertion;
- live migration-ledger capture;
- TBL-013 read-only ledger classification;
- ephemeral ledger-aligned Supabase stage;
- exact dry-run assertion;
- exact apply;
- post-apply ledger verification;
- zero-pending postflight dry run;
- immutable evidence artifact;
- explicit non-activation context.

The workflow does not run arbitrary repository-pending migrations.

### `scripts/content-engine-build-gate1-ledger-aligned-stage.py`

Reuses the already-certified generic ledger-aligned stage builder but replaces its production allowlist with exactly the seven Content Engine Gate 1 versions. This prevents unrelated repository-only migrations from entering the production plan and inserts inert placeholders only for already-applied production-only history.

### `scripts/test-content-engine-build-gate1-ledger-aligned-stage.py`

Permanently locks the production allowlist to exactly seven versions.

## Why a ledger-aligned stage is required

Production contains migrations that are not a simple prefix of repository history, including historical production-only Worker Engine lineage and later migrations already applied beyond some currently-missing Content Factory versions. Running a broad repository `supabase db push` would therefore be unsafe.

The Gate 1 workflow constructs an ephemeral migration view whose timestamp set is:

`live production history + exact approved Content Engine Gate 1 pending set`

Unrelated repository-only migrations are excluded. Production-only versions are represented by inert placeholders solely so the Supabase CLI can reconcile history during dry-run/apply planning.

## Current status

- Worker Engine production prerequisite: **PASS**
- fail-closed runtime prerequisite: **PASS**
- zero active capability-authority prerequisite: **PASS**
- exact seven-version Content Engine ledger gap: **CONFIRMED**
- protected promotion implementation: **ADDED ON BRANCH**
- production Content Engine Gate 1 apply: **NOT YET EXECUTED**
- Edge Function deployment: **NOT EXECUTED**
- autonomy activation: **NOT EXECUTED**

## Promotion acceptance

Before merge/apply, the exact branch head must pass the dedicated Gate 1 workflow plus relevant repository migration-security/rebuild checks.

After production apply, verify read-only that:

1. all seven versions are in `supabase_migrations.schema_migrations`;
2. `curriculum_semantic_materials` and `curriculum_semantic_verdicts` exist;
3. browser roles cannot directly mutate or invoke service-only research/verifier boundaries;
4. active capability-authority grants remain zero;
5. heartbeat/Factory/runtime/Shadow remain OFF and global stop remains ON;
6. no real research or semantic-verification execution occurred merely from installation;
7. Content Factory R1 orchestration can be re-certified without weakening release gates.

Only after these postconditions pass should Gate 2 move to bounded semantic-verifier deployment/activation certification.
