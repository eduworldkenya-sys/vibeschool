# Content Factory R2 production commissioning handover — 2026-08-18

## Mission

Commission the governed R2 Content Factory chain against production Supabase without bypassing Worker Engine authority, without auto-publishing content, and without intentionally triggering Vercel.

## Working branch

`ops/content-factory-commissioning-r2-current-main-20260818`

The original commissioning branch was abandoned for promotion purposes because it was 48 commits behind `main`. This branch was created from current `main` and was verified zero commits behind at the latest reconciliation point.

## Production state proved in this programme

The three R2 executors are deployed and ACTIVE with JWT verification:

- `content-research-worker`
- `content-semantic-verifier`
- `content-authoring-worker`

R2.3 is installed in production and `public.curriculum_authoring_drafts` exists.

The production R2 migration ledger includes:

- `20260818131000` — Content Factory R2 research worker bridge
- `20260818131100` — research evidence trust hardening
- `20260818131200` — semantic verifier
- `20260818131210` — immutable semantic material binding
- `20260818132918` — source-grounded authoring
- `20260818134324` — R2 execution governance registration
- `20260818151313` — Worker Engine shadow certification integrity
- `20260818151646` — Worker Engine blueprint certification coverage
- `20260818151730` — dedicated Content Factory R2 canary worker in shadow

## Governance repairs completed

### R2 execution capability registration

The following capabilities and tool-bound skill manifests are certified but non-activating:

- `content.research.execute`
- `content.evidence.semantic_verify`
- `content.authoring.source_grounded`

They are bounded to autonomy L1 / risk 1, one record per operation, maximum three attempts, verification required, and no publication authority.

### Shadow certification integrity

A Worker Engine defect allowed legacy shadow certification to accept caller-supplied `expected` and `observed` JSON and declare a pass when they were equal. That could create certification evidence without a server-executed tool simulation.

Production now records `execution_method` on shadow runs. New certifications count only `server_shadow_executor_v2` runs that are side-effect-free and independently verified.

The server-side shadow executor now has deterministic, side-effect-free adapters for the three R2 handlers. It does not fetch external sources, invoke a model, modify curriculum content, approve changes, or publish.

### Blueprint-wide certification coverage

A second defect allowed three passing runs on one tool to satisfy the numeric certification threshold even when a worker blueprint declared several capabilities.

Certification now requires fresh passing server-side shadow evidence for every capability listed in the worker's approved creation blueprint.

### Paid-AI worker boundary

`hq_workforce_authorize_model_call` now checks `hq_workforce_workers.paid_ai_allowed` before it can reserve model-token budget or create a model invocation. Previously the worker-level paid-AI flag was not enforced by that authorization function.

At the time this guard was installed, production contained zero Worker Engine model invocations, so the hardening did not invalidate an active invocation history.

## Dedicated canary worker

Worker: `content-factory-r2-canary-01`

Purpose: prove exactly one governed research → semantic verification → source-grounded authoring path before wider runtime activation.

The worker was created through an approved blueprint and seven-day creation contract and entered mandatory shadow state with `paid_ai_allowed=false`.

Independent verifier: `quality-worker-01`.

Three distinct server-executed shadow runs passed with zero side effects:

1. `content.research.execute` — search discovery cannot self-certify semantic evidence.
2. `content.evidence.semantic_verify` — actual material is required before governed model authorization; shadow does not generate a verdict.
3. `content.authoring.source_grounded` — publication authority is false and human acceptance remains required.

Certification ID: `8d4872af-1e3b-4846-9323-70bd828f03c0`.

The worker is now in lifecycle state `certified`, deliberately not `active`.

## Production remains fail-closed

No global Worker Engine execution was enabled during this programme.

The commissioning migrations require runtime execution OFF, autonomy level 0, maximum runtime risk 0, shadow scheduler OFF, global shadow stop ON, and zero active autonomous capability-authority grants at installation time.

There were zero legacy active capability grants when checked before activation work.

## Remaining activation prerequisites

Do not transition the canary worker to `active` until all of the following are installed and verified together:

1. A governed worker identity issuance path with expiry bounded by the active certification.
2. Exact-scope legacy `hq_workforce_capability_grants` for the three R2 capabilities, bound to the canary creation contract.
3. Exact-scope R1.4 `hq_workforce_capability_authority_grants`, one record per operation, low rate/concurrency, idempotency, verification and compensation required.
4. A deliberately small `model_tokens` execution budget and explicit `paid_ai_allowed=true` only for the canary window.
5. One approved objective, selected plan, three plan steps, and task contracts with exact scope/capability/tool lineage.
6. A certified dispatch path that can actually invoke the deployed R2 Edge executors from those Worker Engine tasks. The existing R1.4 database consequential gateway still only executes `work_item.triage_and_own`; it cannot be treated as an R2 executor.
7. Runtime activation must be bounded so enabling the global kernel cannot accidentally make unrelated workers executable.
8. After the canary, runtime/authority/budget should be reduced or revoked unless the production evidence is accepted.

## Data quality warning for the existing queued research job

The current queued job `b2863d6c-46a0-4faf-be38-48588960ce1e` concerns 2026 solid-state battery research. It is useful as an existing R2 trust-chain fixture, but it should not automatically become the first product canary merely because it is queued. The production canary should be selected for direct Kenyan curriculum/product relevance and bound to an exact content target.

## Migration-ledger reconciliation

The migrations created during this commissioning pass have been renamed in the repository to their exact production ledger versions:

- `20260818134324_content_factory_r2_execution_governance_registration.sql`
- `20260818151313_worker_engine_shadow_certification_integrity.sql`
- `20260818151646_worker_engine_blueprint_certification_coverage.sql`
- `20260818151730_content_factory_r2_canary_worker_shadow.sql`

A pre-existing R2.3 mismatch remains: production records source-grounded authoring as `20260818132918`, while current repository history names the canonical migration `20260818150000_content_factory_r2_source_grounded_authoring.sql`. Do not replay it in production and do not solve it with a placeholder/no-op migration. Reconcile the full migration body atomically so both clean rebuilds and the live ledger remain correct.

## Next technical sequence

1. Reconcile the pre-existing R2.3 migration filename/body atomically.
2. Add governed identity issuance and exact canary authority/budget contracts.
3. Add R2 task dispatch/orchestration instead of widening the legacy database gateway.
4. Choose one Kenya-curriculum-relevant canary claim/content target.
5. Run the real end-to-end R2 canary through the deployed executors.
6. Verify immutable evidence, authoring draft, human acceptance boundary and prepared editorial patch lineage.
7. Only then build R2.4 independent Editorial/QA and release orchestration.
8. Prove the learning-feedback loop and throughput/failure operations before calling the Content Factory autonomous.

## Deployment note

Vercel was not intentionally triggered in this commissioning programme. The branch is not ready to merge while activation/orchestration and the R2.3 ledger reconciliation remain open.
