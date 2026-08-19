# VibeSchool Autopilot Production Commissioning — 2026-08-19

State: RECONSTRUCTING

Current-main reconciliation baseline: `4be94b65de9c8b2c3946d26e8b350c5f012006d1`

Supersedes stale PR #308 head `da0d9ad4f444d26ad009aab8238c08d4d94efdde`, whose merge base was `2b8466e3093e2e892f9f625fd1ef72ad58540b1f`.

## Current production baseline

Read-only inspection of Supabase project `yauqsxggtuxuykcbrtzf` during current-main reconciliation:

- consequential runtime execution enabled: false
- runtime autonomy level: 0
- runtime maximum risk: 0
- heartbeat enabled: false
- factory enabled: false
- shadow enabled: false
- shadow scheduler enabled: false
- shadow scheduler Global Stop (`shadow_global_stop`): ON
- active capability authority grants: 0
- all capability authority grants: 27
- execution budgets: 18
- execution intents: 0
- execution verifications: 0
- task verifications: 0
- outcome verifications: 2
- verifier assignments: 0
- execution breakers: 0
- tripped breakers: 0
- dead letters: 1
- execution compensations: 0
- shadow decisions: 1
- visible runtime policies: two historical Content Factory R2 Gate 2 policies; both disabled and revoked

No production runtime activation, authority grant activation, consequential-runtime Global Stop release, shadow stop release, consequential domain mutation, publication, user communication, finance action, or destructive repair was performed during reconciliation.

## Canonical stop semantics

The consequential Worker Engine stop is the intersection of:

1. `hq_workforce_engine_contract.runtime_execution_enabled = false` — R1.2/R1.4 authorization fails with `worker_runtime_global_stop` while false.
2. durable R1.4 execution breakers, including the global `global/global` breaker checked before reservation and before mutation.
3. `hq_workforce_owner_emergency_stop(...)`, which owner-authenticates and atomically restores runtime OFF / L0 / R0, heartbeat OFF, factory OFF, shadow OFF, shadow scheduler OFF, and `shadow_global_stop = true`.

`shadow_global_stop` is specifically the shadow-scheduler stop; it must not be mistaken for the only consequential runtime stop.

## Migration ledger reconciliation

The four original commissioning schema changes already exist in production under these canonical ledger versions and repository reconciliation now uses the same versions:

- `20260819142101_autopilot_commissioning_authority_clock_and_founder_read_model.sql`
- `20260819142350_autopilot_commissioning_owner_breaker_reset.sql`
- `20260819142625_autopilot_commissioning_execution_ledger_write_closure.sql`
- `20260819143210_autopilot_shadow_lineage_enrichment.sql`

This replaces stale branch-only timestamps that collided with current-main migrations and prevents accidental re-execution of already-applied commissioning schema.

A new non-activating reconciliation migration is pending exact-head certification:

- `20260819190000_autopilot_commissioning_capability_competency_binding.sql`

It closes a fail-closed routing defect discovered during canary selection: the three certified Content Factory capabilities had no rows in `hq_workforce_capability_competencies`, while the canonical competency router explicitly refuses capabilities with no competency contract. The migration only adds qualification constraints; it creates no identities, certifications, grants, policies, budgets, tasks or execution authority.

## Historical evidence classification

The two records previously reported as task verifications are actually `hq_workforce_outcome_verifications`. The canonical `hq_workforce_task_verifications` table remains empty, as do execution verifications and verifier assignments. The existing dead letter is historical Content Factory Gate-2 evidence for worker `content-factory-r2-canary-01`, error `CONTENT_SEMANTIC_VERIFY_FAILED`, created 2026-08-18 21:08:52 UTC; it is retained as evidence and is not deleted or rewritten.

## Existing shadow certification evidence

`content-factory-r2-canary-01` has an approved blueprint and a valid creation contract through 2026-08-25. Its canonical lifecycle state is `certified`, not active. It has one live runtime certification through 2026-08-25 issued after exactly three passed, independent `server_shadow_executor_v2` runs with `side_effects_applied=false`, covering:

- `content.research.execute`
- `content.evidence.semantic_verify`
- `content.authoring.source_grounded`

All three server shadow runs were verified by `quality-worker-01`. This evidence does not activate the worker. The catalog row remains `draft`; production has no active capability authority for it.

The historical three-capability Gate-2 operator is not accepted as the first Autopilot canary because it activates a three-stage chain. The commissioning contract requires one execution worker, one execution capability, one narrow resource scope, one tiny budget, one independent verifier and short-lived authority.

## Security interpretation

Production remains fail-closed. The canonical Founder/constitution read model, owner-governed runtime setter, owner breaker reset, execution-ledger write closure, and durable shadow-lineage trigger are present. `service_role` cannot execute runtime activation, cannot invoke the legacy breaker reset, and cannot directly update execution budgets or dead letters. Sensitive execution/authority ledgers inspected have RLS enabled and no direct anon or ordinary-authenticated write access.

Presentation aliases do not appear in production authorization function bodies; machine worker identity and the authority envelope remain separate from display names.

## Owner gates preserved

- first production runtime activation / consequential-runtime Global Stop release
- first real capability-authority activation
- first consequential canary mutation
- content publication
- user-facing external communication
- finance/M-Pesa
- destructive repair
- legal/policy decision

## Promotion rule

Do not merge or activate merely because one workflow is green. The reconciled candidate must pass clean reconstruction, migration security, the Autopilot commissioning adversarial matrix, Worker Engine authority/budget/idempotency/verification/compensation/breaker/forensic contracts, TypeScript/build, engineering control-plane freshness, and read-only production drift re-certification against exact-current main.
