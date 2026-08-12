# Vibeschool Worker Engine — Architecture-to-Runtime Reconciliation Matrix

**Date:** 2026-08-12  
**Evidence source:** current production Supabase catalog/runtime + recovered Worker Engine Architecture Freeze v1 + canonical one-engine authority.  
**Purpose:** remove the final architecture-discovery blocker before implementation coding.

## Classification

- **KEEP** — existing runtime materially implements the intended capability and should be preserved.
- **HARDEN** — useful implementation exists but does not satisfy the frozen invariant completely.
- **MIGRATE** — historical representation must transition to the canonical contract/state model.
- **BUILD** — no sufficient canonical implementation was found.
- **REVIEW** — scope/authority decision must be made explicitly before schema change.

| Canonical capability | Current runtime evidence | Classification | Required implementation delta |
|---|---|---|---|
| One engine | `hq_workforce_*` control plane + canonical repo authority | KEEP | No parallel engine/foundry/control plane |
| Deterministic-first 95/5 | all 10 active workers have paid AI disabled; skills carry execution method | KEEP/HARDEN | Replace simple boolean with skill-level AI class and Model Gateway |
| Demand/gap signals | `gap_signals`, capacity/context detectors | KEEP | Connect to scheduler/event heartbeat |
| Deterministic gap diagnosis | `diagnose_gap` explicitly repairs process/routing/tool/skill before staffing | KEEP | Extend evidence and capacity metrics |
| Quantified workforce diagnosis | `hr_diagnoses` implements eliminate/redesign/automate/train/rebalance/temp/human/digital-worker tree | KEEP | Bind inputs to sealed DemandEvidence rather than caller-supplied JSON alone |
| Worker creation | `create_probation_worker` creates role/worker/assignment/skill | HARDEN | Require approved immutable WorkerCreationContract/Blueprint, identity, budget, scope and risk gates |
| Worker lifecycle | current creation uses `probation -> active`; all 10 live workers are `active` | MIGRATE | Canonical single-writer lifecycle: PROPOSED -> REQUESTED -> INSTANTIATED -> PROVISIONED -> SHADOW -> CERTIFICATION_PENDING -> CERTIFIED -> ACTIVE -> SUSPENDED/REMEDIATION/RETIRED/ARCHIVED |
| Shadow | no canonical shadow state/isolation proven | BUILD | Production-isolated shadow execution and evidence replay |
| Certification | worker certifications + probation policy + skill certification exist | HARDEN | Governance-owned certification, expiry, minimum verified shadow outcomes, adversarial/boundary/recovery tests |
| Worker identity | worker UUID/key exists, but no canonical credential/identity binding found | BUILD | WorkerIdentity issuance, expiry, credential reference and live revocation |
| Roles/jobs | 10 workers/lanes, 5 jobs; 5 workers have no job key | MIGRATE | Normalize all canonical workers into job/blueprint contract where applicable |
| Skills | 12 versioned skills with procedure/verification/recovery | KEEP/HARDEN | Formal immutable SkillContract, AI class, tool contracts, capability requirements |
| Permissions | worker `permissions` JSON exists | MIGRATE | Enforceable capability grants with operation/resource/scope/grantor/expiry/revocation |
| Approval boundaries | worker JSON boundaries + decision inbox | KEEP/HARDEN | Bind to policy/blueprint ceiling and task contract |
| Context authorization | lane/fact/provenance/snapshot/skill authorization RPCs exist | KEEP/HARDEN | Require context envelope at every privileged execution boundary |
| School scope | 0 `school_id` columns across 32 workforce tables | REVIEW | Classify platform-global vs school-scoped contracts; add explicit scope only where semantically required; never blindly add school_id everywhere |
| Budgets/quotas | no dedicated canonical worker execution budget primitive proven | BUILD | Transactional reservations/consumption for compute/tool/model/exposure limits |
| Task/job routing | runs/jobs/assignments/lanes/handoffs exist | KEEP/HARDEN | Canonical TaskContract, schema version, idempotency, retry/visibility/backpressure/DLQ |
| Scheduler/event heartbeat | lane schedule/event metadata exists; production `cron.job` has no workforce job | BUILD | Canonical heartbeat/event consumer; do not assume persistent Vercel listener |
| Execution kernel | `execute_safe_queue` only performs `internal_review_only`, explicitly `side_effects=none` | BUILD | Dispatcher from certified SkillContract through Tool Gateway to actual deterministic operations |
| Tool Gateway | no universal canonical enforcement point proven | BUILD | Capability + scope + identity + revocation + budget + task checks before any tool effect |
| Model Gateway | no canonical gateway proven | BUILD | AI-0 denial; AI-enabled skill contracts; token/model/provider budget; deterministic verification |
| Outcome verification | `verify_run` requires completed+authorized run, expected/actual, execution certification, method and independent evidence | KEEP/HARDEN | Make verification universal and bind verifier independence to contract |
| Recovery | recovery actions/planner exist | KEEP/HARDEN | Connect automatically to execution failures, lifecycle remediation and recertification |
| Monitoring | monitor detects stuck queued/running runs older than one hour | HARDEN | Add capability expiry, credential expiry, budget, verification backlog, failure rate, recovery rate, policy violations, DLQ and overload alerts |
| Security boundary | all inspected workforce tables have RLS enabled with no direct policies; only decision/list RPCs exposed to authenticated and both assert HQ owner | KEEP | Preserve fail-closed direct-table posture; add negative acceptance tests |
| Audit/evidence | security events, corrections, evidence, certifications, run/verification trace triggers exist | HARDEN | Canonical append-only versioned AuditEvent + concurrency-safe hash-chain/anchors + full history reconstruction |
| Learning | candidates, positive evidence, corrections, promotions, replay and rollback exist | KEEP/HARDEN | Permit learning only from verified evidence; bind promotion to canonical SkillContract lifecycle |
| Worker performance | performance view/rates exist | KEEP/HARDEN | Feed quantified Workforce Intelligence and recertification/suspension thresholds |
| Autonomous worker generation | diagnosis can recommend `create_digital_worker_probation`; creation RPC exists | HARDEN/BLOCKED | Connect only after creation contract, lifecycle, shadow, certification, identity/capability/budget and reference-worker gates exist |
| Reference worker | no worker proven against complete frozen lifecycle/security suite | BUILD | Operations Worker should be first end-to-end reference worker |

## Production facts captured during reconciliation

- 32 `hq_workforce_*` tables.
- 10 workers and 10 lanes.
- 12 skills.
- 5 jobs; 5 of 10 workers currently have no `job_key`.
- 18 runs; current observed run states are 16 `decision_required` and 2 `verified`.
- 8 gap signals and 8 quantified HR diagnoses.
- The eight HR diagnosis fixtures cover all major decision branches: eliminate task, redesign process, deterministic automation, train existing worker, rebalance lanes, temporary capacity, human hire and digital worker probation.
- 10 active workers; zero active workers have paid AI enabled.
- 0 workforce cron jobs were found in production.
- Workforce event triggers found are trace synchronization on runs and outcome verification, not a general autonomous scheduler.
- 0 `school_id` columns were found across the 32 workforce tables. This is a scope-classification issue, not permission to add the column blindly.
- All inspected workforce tables have RLS enabled and no direct RLS policies, creating a fail-closed direct Data API posture.
- Only `hq_workforce_decide` and `hq_workforce_list_decisions` are granted to `authenticated`; both are SECURITY DEFINER and both call `hq_assert_owner()`.
- Supabase security advisor reports the workforce no-policy state as informational RLS-enabled/no-policy findings; this matches the deliberate service/RPC-oriented fail-closed posture and must not be 'fixed' by adding broad policies.

## Critical semantic correction

`hq_workforce_execute_safe_queue()` currently marks eligible queued runs running/completed while recording:

```text
action = internal_review_only
side_effects = none
```

Therefore a current `completed` run must not be interpreted as proof that a departmental business action was executed. The real execution kernel is still a BUILD item. Independent outcome verification remains the authoritative success concept.

## Coding readiness decision

The architecture discovery/reconciliation gate is now **GREEN FOR CONTROLLED IMPLEMENTATION CODING**.

This does **not** mean the autonomous workforce is production-ready. It means we now know what to preserve, harden, migrate and build without inventing a second engine.

### First coding tranche

**WE-L1 — Authority & Lifecycle Convergence**

1. Canonical contract registry primitives.
2. Blueprint + WorkerCreationContract authority ceiling.
3. Canonical lifecycle transition registry and single-writer transition RPC.
4. Transitional mapping for legacy `active` workers without falsely recertifying them.
5. WorkerIdentity + revocation primitive.
6. Capability grants.
7. Execution budget primitive.
8. Negative acceptance tests for illegal transitions, missing authority, revoked identity, absent capability and exhausted budget.

### Explicitly deferred until WE-L1 passes

- autonomous creation activation;
- production-effect Tool Gateway execution;
- Model Gateway/AI execution;
- scheduler-driven autonomous heartbeat;
- broad worker expansion.

Those follow in WE-L2+ after the authority kernel is mechanically proven.

## Non-negotiable implementation rule

No new table/RPC is justified merely because the architecture names a concept. Before each implementation change, prove that no existing `hq_workforce_*` artifact can be safely extended. Preserve the one-engine rule and the protected branch/deployment workflow.