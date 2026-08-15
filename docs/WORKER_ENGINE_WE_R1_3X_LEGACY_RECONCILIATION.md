# Worker Engine WE-R1.3X — Legacy Reconciliation & Canonical Intelligence Model

Date: 2026-08-15
Status: ACTIVE ENGINEERING MISSION — NON-ACTIVATING

## Mission

Evolve the single canonical Vibeschool Worker Engine from worker/task/lane-first orchestration into a governed organisational intelligence system without weakening the production safety kernel or creating a parallel engine.

Canonical reasoning direction:

Sense → Objective → Context/Memory → Plan DAG → Capabilities → Resources → Authority → Competencies → Worker/Team → Shadow Simulation → Human Decision → Future Governed Execution → Verification → Learning.

Jobs remain implementation units beneath plans. Skills remain independently certified procedures beneath capabilities. Lanes remain organisational metadata and policy context, not hard routing prisons. Factory becomes a last-resort response to a proven persistent workforce-capacity gap.

## Non-negotiable invariants

1. One Worker Engine. Extend/consolidate `hq_workforce_*`; do not create a competing control plane.
2. No destructive legacy deletion before successor parity, dependency proof, regression evidence and an explicit retirement decision.
3. Heartbeat remains OFF.
4. Worker Factory remains OFF.
5. Consequential runtime execution remains OFF.
6. Runtime autonomy remains L0 and maximum autonomous risk remains R0 during reconciliation.
7. Production Shadow remains separately owner-gated.
8. Authority, RLS, identity, lifecycle/revocation, budgets, certification, immutable evidence, global stop, anomaly pause, promotion separation and fail-closed behavior are preserved or strengthened.
9. Historical migrations are immutable history. Reconciliation is forward-only.
10. A build passing is not certification: contract, regression, adversarial, migration and comparative-shadow evidence are required.

## Senior execution loop

For each gate: Inspect → dependency-map → specify invariant → implement smallest compatible successor → test → adversarial test → compare with legacy behavior → document evidence → mark gate complete → only then proceed.

No later gate may compensate for an unfinished earlier gate.

## Gate X0 — Archaeology and freeze

Produce a dependency-complete inventory of Worker Engine tables, functions, triggers, policies, grants, TypeScript consumers, HQ surfaces, workflows, tests and documentation. Classify every relevant legacy primitive as KEEP, EXTEND, ADAPT, SUPERSEDE, COMPATIBILITY or RETIRE-LATER. Record successor and retirement preconditions. No runtime activation.

Exit criteria: every known legacy intelligence entrypoint has an owner, dependency map, classification and successor strategy; safety primitives are explicitly frozen.

## Gate X1 — Objective Kernel

Introduce first-class objectives with desired outcome, source/provenance, scope, constraints, success criteria, evidence requirements, risk, priority/SLA, hierarchy and lifecycle. Preserve jobs as execution units beneath plan steps.

Exit criteria: one objective can safely own multiple candidate plans and later produce multiple plan-step jobs without breaking existing job consumers.

## Gate X2 — Memory and Context Fabric

Unify governed context around typed facts, observations, hypotheses, policies, decisions, outcomes and learned patterns with provenance, freshness, confidence, classification, scope and validity.

Exit criteria: planning can distinguish verified/current facts from stale or inferred context and fails closed when required evidence is missing or contradictory.

## Gate X3 — Capability and Competency Graphs

Separate capabilities (what outcomes require) from certified skills (how procedures are performed). Model worker competency with proficiency, certification, empirical reliability, sample size, recency, scope experience and failure history.

Exit criteria: no canonical routing decision requires literal department equality; uncertified skills still have zero autonomous execution authority.

## Gate X4 — Resource Registry and Resolver

Create a Worker Engine resource abstraction for governed facts, tools, models, APIs, documents, compute, budgets, human reviewers, workers and certified skills. Resolve least-cost, least-authority, sufficiently reliable resources subject to scope, classification, jurisdiction, quotas and health.

Exit criteria: planners can explain selected and rejected resources and cannot silently use unavailable or unauthorized resources.

## Gate X5 — Planning Graph

Represent objectives as candidate plan DAGs with dependencies, capability requirements, resources, authority, expected outcomes, verification, compensation, risk, cost and latency. Detect cycles and impossible plans.

Exit criteria: multiple candidate plans can be compared and the least-sufficient safe plan can be simulated without consequential production writes.

## Gate X6 — Competency routing and collaboration

Replace lane-first/first-worker selection with scored eligibility across capability coverage, competencies, certification, authority/scope, empirical reliability, workload, resource availability, cost and risk. Support individual, team, deterministic automation + worker, worker + human and human-only outcomes.

Exit criteria: legacy and new routing run comparatively in Shadow; new routing demonstrates no authority regression and materially reduces false `worker_selection_missing` outcomes.

## Gate X7 — Scheduler reconciliation

Preserve R1.3 scheduler safety ceilings and anomaly controls while changing orchestration from open-work-item scanning into Sense → Objective Detection → Context → Planning → Resolution → Routing → Shadow Simulation.

Exit criteria: scheduler orchestrates intelligence but does not contain hidden planning policy or consequential execution.

## Gate X8 — Factory reconciliation

Replace workload→worker-demand reasoning with a last-resort gap diagnosis: routing → context → resource → capability composition → skill genesis/certification → collaboration → rebalance → temporary capacity → human judgment → persistent worker-capacity gap. Only the final condition may produce a Factory recommendation.

Exit criteria: Factory remains OFF; recommendation mode cannot create/certify/authorize a worker and every Factory proposal proves why cheaper reuse/composition options failed.

## Gate X9 — Calibration, verification and institutional learning

Replace decorative/fixed confidence with empirically calibrated predictions tied to human judgments and verified outcomes. Track calibration and reliability for plans, capabilities, workers/teams and routing decisions. Feed verified learning into governed memory without silently converting inference into fact.

Exit criteria: confidence is measurable against outcomes; verification remains independent of execution reasoning where required.

## Gate X10 — Full certification and retirement decision

Run contract, regression, adversarial, migration-replay and comparative Shadow suites. Verify authority, tenant isolation, learner-data boundaries, stale/contradictory evidence, revoked identities/skills, cyclic plans, retry storms, queue/concurrency ceilings, collaboration explosion, Factory bypass and scheduler bypass.

Exit criteria: evidence-backed KEEP/RETIRE decisions for compatibility paths and a separate explicit decision on whether any capability is eligible for a future WE-R1.4 canary. This mission itself does not activate autonomy.

## Initial legacy reconciliation decisions

- Canonical one-engine rule: KEEP permanently.
- Authority/lifecycle/RLS/budget/certification/evidence/promotion safety: KEEP permanently.
- `lib/hq/workforce/router.ts` exact department matching: SUPERSEDE behind compatibility path at X6.
- R1.3 lane-equality worker selection: SUPERSEDE at X6.
- R1.3 single-skill recommendation selection: ADAPT into capability composition at X3/X5.
- R1.3 fixed recommendation confidence: SUPERSEDE at X9.
- R1.3 scheduler resource/anomaly safety shell: KEEP + EXTEND at X7.
- R1.3 open-work-item candidate discovery: ADAPT beneath Objective detection at X1/X7.
- WE-L8/L11/L13 demand/Factory reasoning: COMPATIBILITY / RETIRE-LATER after X8 parity proof; never activate as canonical Factory logic.
- Jobs/assignments: KEEP + move beneath objective/plan semantics.
- Decision Inbox and Control Room: KEEP + extend to objectives, plans, capability/resource evidence and calibration.

## Completion rule

A gate is complete only when implementation and evidence satisfy its exit criteria. The mission advances sequentially X0 → X10. No activation shortcut is permitted.