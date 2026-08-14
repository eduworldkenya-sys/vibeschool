# Worker Engine WE-R1.3 — Governed Shadow Operations

Date: 2026-08-14
Status: IMPLEMENTATION IN PROGRESS — PRODUCTION SHADOW NOT AUTHORIZED

## Mission contract

Observe → Detect → Reason → Propose → Verify → Measure → Human decision.

WE-R1.3 does not authorize Observe → Execute.

## Preserved production boundary

The WE-R1.2 certified boundary remains authoritative until an owner-authorized production promotion:

- heartbeat OFF;
- Worker Factory OFF;
- runtime execution OFF;
- autonomy L0;
- maximum autonomous risk R0;
- no Worker Engine heartbeat cron;
- no consequential shadow execution.

Repository implementation does not itself authorize production migration or real production Shadow Mode.

## Certification gates

1. R1.3.1 Runtime telemetry architecture — trace IDs, events, evidence, provenance, measurement.
2. R1.3.2 Skill Registry — immutable versions, complete procedure contracts, certification lifecycle, shadow capability.
3. R1.3.3 Decision Governance — first-class review objects and non-executing approvals.
4. R1.3.4 Shadow Gateway — structurally non-consequential path and hypothetical authority evaluation.
5. R1.3.5 Shadow Scheduler — bounded observe/detect/recommend cycles only.
6. R1.3.6 HQ Control Room — overview, workers, jobs, runs, decisions, skills, authority, evidence, failures, resources.
7. R1.3.7 Resource Governance — quotas, concurrency, retry ceilings, queue ceilings, anomaly breakers.
8. R1.3.8 Adversarial Certification — authority, isolation, runtime, resource and reasoning attacks.
9. R1.3.9 Production Shadow Promotion — protected migration with owner authorization.
10. R1.3.10 Shadow Trial — real conditions, no consequential action.
11. R1.3.11 Measurement — compare recommendations with expected/human outcomes.
12. R1.3.12 Certification Report — evidence-backed decision on whether one capability may enter WE-R1.4.

## Telemetry chain

Every consequential recommendation must be reconstructable as:

Worker → Observation → Candidate Job → Reasoning → Skill → Proposed Action → Authority Result → Evidence → Expected Outcome → Verification.

`trace_id` is the end-to-end correlation key. Ordered shadow events provide causal reconstruction; evidence records preserve provenance and classification.

## Skill contract

A governed skill version contains purpose, inputs, scope, resources, data classes, risk, autonomy requirement, preconditions, expected outcome, verification, failure handling, compensation, retry policy, escalation, immutable version and certification state.

Invariant: uncertified skill = zero autonomous execution authority.

Shadow use additionally requires `shadow_capable=true`.

## Decision contract

Decision lifecycle:

`proposed → awaiting_review → approved | rejected | revise → verified → closed`

During WE-R1.3, approval is a judgment record only. It does not invoke `hq_workforce_tool_gateway_execute` and does not authorize the proposed production mutation.

## Initial certification thresholds

- unauthorized consequential executions: 0;
- cross-school/tenant leakage: 0;
- authority bypasses: 0;
- unexplained recommendations: 0;
- required escalations produced: 100%;
- consequential recommendations with evidence: 100%;
- correct worker selection: ≥95%;
- correct skill selection: ≥95%;
- duplicate candidate jobs: <1% target;
- unbounded retry loops: 0;
- recommendations traceable end-to-end: 100%.

Also measure detection precision/recall, false positives, human agreement, confidence calibration, recommendation latency, worker reliability and lane reliability.

## Adversarial rule

Dangerous or ambiguous paths terminate in DENY, ESCALATE or PAUSE. There is no implicit permission.

Required attack families: authority escalation, revoked/wrong skills, wrong lane/risk, tenant crossover, learner-data crossover, jurisdiction mismatch, direct gateway invocation, scheduler bypass, forged/expired identity, expired capability, job explosion, recursive jobs, retry storms, concurrency floods, missing/contradictory/stale evidence and duplicate recommendations.

## Factory boundary

Factory remains OFF. Recommendation-mode design may identify a capacity or skill gap and propose a worker specification for human review. It may not create, certify or grant authority to a worker.

## Owner gates

Engineering proceeds without owner interruption until one of these boundaries is reached:

1. production migration authorization for WE-R1.3 infrastructure;
2. permission to begin real production Shadow Mode;
3. selection/approval of the first WE-R1.4 L3 canary capability;
4. materially expanded authority or sensitive learner/teacher-data proposal;
5. eventual Factory recommendation-only activation.

## Current repository implementation

Migration `20260814111500_worker_engine_we_r1_3_shadow_governance_kernel.sql` establishes the first fail-closed foundation:

- shadow run traces;
- ordered trace events;
- evidence/provenance records;
- human decision objects;
- expanded skill manifests;
- hypothetical shadow authority evaluation;
- non-executing decision review;
- explicit shadow stop/configuration fields;
- RLS plus denied direct anon/authenticated access;
- a migration-time assertion that heartbeat, Factory, runtime execution, Shadow Mode and shadow scheduler remain OFF.

No scheduler, production activation, Factory activation or consequential worker action is introduced by this foundation.