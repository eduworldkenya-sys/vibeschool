# WE-R1.3X — Legacy Architecture Reconciliation

Status: ENFORCED RECONCILIATION CONTRACT
Mission: Global Capability Intelligence Fabric

## Purpose

Vibeschool accumulated strong Worker Engine safety and execution primitives before it had the current objective-first capability architecture. This document prevents historical success from becoming permanent architectural debt.

The rule is not "delete old code." The rule is:

**Preserve proven controls and audit history. Supersede inferior intelligence assumptions. Maintain exactly one canonical reasoning path.**

## Canonical intelligence path

Sense → Objective → Context/Memory → Required Competencies → Candidate Workers/Collaborators → Capability DAG → Registered Resources → Alternative Plans → Least-powerful sufficient plan → Shadow Simulation → Hypothetical Authority → Evidence → Human Decision → Measurement → Calibration/Learning.

Jobs/tasks remain implementation units beneath a plan. They are not the primary intelligence object.

## Component disposition

### KEEP

- WE-L1 identity, lifecycle, revocation and authority ceilings.
- Capability grants and execution budgets as defensive authorization primitives.
- WE-L2 task/tool gateway as a future separately-authorized execution substrate only.
- WE-L3 worker-certification evidence and verifier separation.
- Runtime policy kernel and authorization-event evidence.
- RLS/service-only boundaries.
- Global stops, anomaly pauses, rate/concurrency/retry ceilings.
- Production promotion versus runtime activation separation.
- Ledger-aligned migration planning, read-only verification and immutable CI evidence.
- WE-R1.3 operational traces, evidence, Decision Inbox and owner-only Control Room.

### UPGRADE / CONSOLIDATE

- Deterministic/model gateways become registered resources with cost, trust, health and authority metadata.
- Shadow scheduler becomes an observation/orchestration trigger; planning intelligence lives in the objective/capability layer.
- Work-item candidate detection feeds objectives rather than directly selecting a worker/tool.
- Decision Inbox consumes objective/plan evidence and measured outcomes.
- Control Room exposes both preserved safety posture and canonical intelligence state.

### SUPERSEDE

- Literal `department/lane → worker` routing.
- `one candidate → one arbitrary skill` selection.
- Operations-only task detector as a global intelligence model.
- Heartbeat-driven reasoning as the canonical planner.
- Backlog → workforce shortage inference.
- Autonomous Factory deciding worker creation before resource/capability/skill/routing/collaboration/capacity diagnosis.

The historical implementations may remain for lineage and regression evidence, but they are non-canonical and must not regain positive authority during WE-R1.3X.

## Worker selection contract

Worker selection is:

Objective → required competencies → certified competency matches → active/lifecycle-valid candidates → measured reliability → workload/capacity → collaboration fit → best assignment.

Department/lane can provide contextual evidence, never exclusive routing authority.

## Capability contract

A plan step can only use a registered certified Shadow-capable skill and explicitly bound registered resources. Multi-step plans use capability graph dependencies. Missing capability fails closed and enters Skill Genesis or human escalation.

## Factory contract

Factory is last resort.

Required diagnostic order:

1. objective/routing ambiguity;
2. missing or unhealthy resource;
3. missing composable capability;
4. missing certified skill;
5. collaboration opportunity;
6. capacity/load constraint;
7. only then a true worker gap.

WE-R1.3X Factory output is recommendation-only. It cannot instantiate, certify, activate or grant authority to workers.

## Execution substrate boundary

Legacy TaskContracts, Tool Gateway, budgets and verification are retained because they are useful controlled execution primitives for a later autonomy mission.

During WE-R1.3X:

- runtime execution remains OFF;
- autonomy remains L0;
- heartbeat remains OFF;
- Worker Factory remains OFF;
- planning cannot invoke the consequential gateway;
- approval records judgment only;
- no new canonical path may bypass objective/plan/capability/resource evidence.

## Data migration strategy

Do not destructively delete historical tables or functions merely because their intelligence assumptions are superseded. Preserve lineage, audit evidence and replay compatibility. Introduce explicit architecture disposition, switch canonical readers/writers to the new path, prove parity/adversarial behavior, and retire positive authority before considering physical removal in a later cleanup mission.

## Acceptance requirements

Reconciliation is not certified unless tests prove:

- an objectively qualified worker can be selected across department/lane boundaries;
- uncertified competencies are excluded;
- every recommended path has an objective and valid plan DAG;
- registered resources are required for capability use;
- disabled/high-risk resources fail closed;
- missing capability produces escalation/Skill Genesis rather than improvised execution;
- Factory reasoning remains recommendation-only;
- legacy heartbeat/factory/runtime controls remain OFF;
- no consequential action occurs;
- old intelligence components are explicitly non-canonical;
- safety/identity/authority/execution substrates remain intact.

## Senior engineering standard

Prefer evolution over destructive rewrite, explicit contracts over convention, compatibility over hidden coupling, evidence over confidence claims, least privilege over broad access, competency over organization-chart routing, capability composition over agent proliferation, and measurable outcome learning over self-reported intelligence.
