# Worker Engine R1.4 operational handover — 2026-08-18

## Objective

R1.4 recovery → Global Shadow Trial → bounded canary → first Content Factory remediation job → operational certification.

## Actions completed

- Verified the production Worker Engine migration ledger before intervention. The target R1.4 range remained incomplete and ended at `20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge`.
- Verified production remained fail-closed: heartbeat OFF, factory OFF, runtime execution OFF, autonomy L0, maximum risk 0, Shadow OFF, Shadow scheduler OFF, global stop ON.
- Inspected the canonical R1.4 production-recovery workflow and preserved its safety boundary: ledger-aligned staging, disposable production-drift reproduction, exact dry-run proof, protected `production-migration-repair` environment, post-apply ledger verification, and no runtime/autonomy activation.
- Because the connected GitHub interface did not expose `workflow_dispatch`, created a workflow-only retrigger branch and merged PR #241. The only workflow-file change was a comment so the existing main-push recovery trigger would fire; no application code, migration SQL, runtime flags, autonomy settings, or Vercel configuration changed.
- PR #241 merged as `8565f8b104ef26d6cc23849cb75aea05ac0f3fdf`.
- Rechecked production repeatedly after the merge. Recovery had not crossed into production at those checkpoints.
- User later reported the GitHub run as passed. A fresh live-production verification was performed immediately rather than trusting the green control-plane signal alone.
- Fresh production ledger still contains `20260818111900` followed by unrelated curriculum-authority migrations (`20260818125000`, `20260818130000`, `20260818133000`); the required Worker Engine R1.4 recovery migrations after `20260818111900` are still absent.
- Fresh schema verification confirms recovery is not merely a ledger-display anomaly: `hq_workforce_capabilities`, `hq_workforce_skill_capabilities`, `hq_workforce_plans`, `hq_workforce_plan_steps`, `hq_workforce_plan_step_capabilities`, and `hq_workforce_capability_authority_grants` are absent from production. `hq_workforce_task_contracts` exists from older lineage.
- Reverified the engine remains fail-closed: runtime OFF, autonomy L0, maximum risk 0, Shadow OFF, global stop ON.
- Therefore the observed green GitHub result is classified as certification/check success, not proof that the protected production apply completed.
- Did not bypass the protected environment with direct production DDL.
- Did not start the Global Shadow Trial, canary, or Content Factory business job because their mandatory R1.4 recovery precondition is still not met.

## Current blocker

The protected production **apply** has not taken effect even though a GitHub run/check was reported green. The live database is authoritative for operational readiness and proves the R1.4 backfill is still missing.

The recovery contract requires the workflow itself to perform the late backfill through the protected `production-migration-repair` environment, verify every pending migration in the post-apply ledger, and leave zero pending recovery work. Until those postconditions are observable in production, recovery is not complete.

## Safety state at handover

- `heartbeat_enabled = false`
- `factory_enabled = false`
- `runtime_execution_enabled = false`
- `runtime_autonomy_level = 0`
- `runtime_max_risk = 0`
- `shadow_enabled = false`
- `shadow_scheduler_enabled = false`
- `shadow_global_stop = true`

## Required continuation gate

Do not execute Shadow, canary, or a business job until production contains the certified R1.4 recovery migrations beyond `20260818111900`, including the recovery workflow's required `20260818112000` and `20260818113000` markers, the canonical R1.3X/R1.4 planning and capability objects exist, and the post-recovery fail-closed state is verified again.

## Continuation sequence once recovery lands

1. Verify the complete recovered migration ledger and zero unintended active capability-authority grants.
2. Verify the exact fail-closed engine state again.
3. Execute the canonical Global Shadow Trial with no consequential mutation and inspect planning, worker selection, capability/authority decisions, policy/resource gates, telemetry, verification, escalation and circuit-breaker evidence.
4. Execute exactly one bounded low-risk governed canary for `internal.work_queue.prioritize`; do not use payments, authentication, curriculum publication or any high-impact mutation.
5. Verify the canary's execution dossier and postconditions, including mutation scope and compensation/recovery evidence.
6. Select exactly one existing Content Factory remediation case and run it through the governed Worker Engine path.
7. Certify operational readiness from observed evidence. Expand autonomy only by explicit bounded policy after evidence supports it; do not globally switch the engine on.

## Deployment note

The PR #241 main merge caused the repository's existing Vercel integration to report a successful deployment even though Vercel was not invoked directly. No additional main commit should be made solely for this handover; keep this document on its branch until the operational chain is complete or a deliberate merge is required.
