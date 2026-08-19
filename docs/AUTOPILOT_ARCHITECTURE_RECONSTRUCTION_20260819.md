# VibeSchool Autopilot — Canonical Architecture Reconstruction

Date: 2026-08-19
Branch baseline: `8fff836a89cc3ebb9499cde77d654667be553e8a`
State: ARCHITECTURE FROZEN

## Decision

VibeSchool Autopilot is not a replacement Worker Engine and not a second HQ. It is the governance/orchestration contract over the existing Worker Engine execution subsystem, HQ Founder surface, Content Factory, Curriculum Intelligence and evidence systems.

Canonical loop:

`Objective/Intent -> Approved Plan -> Plan Step/Work -> Constitution/Policy -> Capability Authority -> Budget -> Lease/Execution Intent -> Execution -> Artifact/Evidence -> Independent Verification -> Outcome -> Finding/Decision/Dead Letter/Learning -> HQ`

No broad parallel `autopilot_*` schema is permitted unless reconstruction proves a primitive is genuinely absent.

## Eight contracts and canonical owners

| Contract | Canonical owner |
|---|---|
| Intent | `hq_workforce_objectives` plus objective events/context |
| Work | `hq_workforce_plans`, `hq_workforce_plan_steps`, dependencies and task contracts |
| Authority | capability authority grants intersected with runtime policy, certified capability/skill, resource scope and owner-approved plan hash |
| Budget | `hq_workforce_execution_budgets` plus runtime rate/concurrency ceilings |
| Execution | task contract + execution intent + canonical consequential gateway + immutable execution evidence |
| Artifact | existing HQ artifact/version/provenance/approval system and vertical immutable artifact ledgers |
| Verification | verifier assignments + execution verifications + task/outcome verification evidence |
| Outcome | execution outcomes/escalations mapped to findings, decisions, dead letters, incidents and learning evidence |

## Constitution

The Constitution is machine-enforced by intersection, not by a markdown manifesto. Effective authority is the minimum permitted by:

1. owner-controlled engine contract/global stop;
2. enabled runtime policies;
3. certified capability version;
4. certified skill/tool contract;
5. capability-authority grant lifecycle;
6. approved immutable plan hash;
7. resource/scope constraints;
8. autonomy/risk ceilings;
9. execution budget/rate/concurrency ceilings;
10. breaker state;
11. required idempotency/preconditions;
12. required independent verification and compensation.

`service_role` is transport, not Founder authority. A worker cannot certify/activate its own grant, modify owner policy, approve an objective, release Global Stop or expand its own autonomy.

## Primitive classification

| Primitive | Classification | Future responsibility |
|---|---|---|
| Worker Engine | KEEP + EXTEND | canonical execution/workforce subsystem |
| HQ | KEEP + EXTEND | Founder operating/read-model surface |
| objectives/events/context | KEEP | intent/objective truth |
| plans/steps/dependencies | KEEP | planning/work graph |
| task contracts | KEEP + EXTEND | executable work envelope |
| capabilities/skills/resources | KEEP | machine capability ontology |
| capability authority grants | KEEP + EXTEND | bounded executable authority |
| runtime policies/engine contract | KEEP + EXTEND | Constitution inputs/global stop |
| execution budgets | KEEP | budget/rate/blast-radius envelope |
| execution intents | KEEP + EXTEND | idempotent consequential-intent evidence |
| task runs | KEEP | attempt/lease execution state |
| execution verifications | KEEP + EXTEND | immutable independent execution proof |
| verifier assignments | KEEP | separation-of-duty binding |
| execution outcomes/escalations | KEEP + EXTEND | deterministic outcome routing |
| compensation | KEEP | reversible recovery evidence |
| breakers/events | KEEP | circuit-breaker truth/history |
| dead letters | KEEP | exhausted/terminal recovery lane |
| HQ findings | KEEP | exception intelligence |
| HQ decisions | KEEP + EXTEND | Founder-authority decisions |
| HQ artifacts/version/provenance | KEEP + EXTEND | generic immutable output/provenance |
| Content R2 research/verifier/authoring | KEEP | first vertical adapter/proof |
| broad duplicate `autopilot_*` tables | RETIRE/DO NOT CREATE | would create competing architecture |

## Organizational identities

Human-facing names are aliases only. They never participate in authorization predicates.

Provisional organizational presentation:

- Laban — Cofounder / Chief Operating Intelligence; planning/orchestration and Founder-decision preparation, never root.
- Travis — Content leadership.
- David — Operations.
- Mykphyl — Intelligence and planning.
- Luca — QA and independent verification.
- Damian — Platform and reliability.
- Nina — Research and evidence.
- Michael — Security and reconciliation.
- Phyllys — School success and institutional operations.

Authorization remains `worker_id/worker_key + capability/version + resource scope + risk/autonomy + policy version + authority grant + evidence`. Renaming an alias cannot change permissions.

## Laban invariant

Laban may observe, plan, decompose, coordinate, diagnose, recommend retry and prepare decisions. Laban may not approve its own objective, issue/activate its own authority, modify the Constitution, bypass budgets, self-verify high-risk work, release Global Stop, publish protected content, authorize payment or perform unapproved production repair.

## Content proof

The Content Factory already supplies a strong vertical proof: research evidence -> semantic verification -> source-grounded authoring -> immutable draft -> explicit HQ owner acceptance -> existing prepared editorial patch -> separate proposal approval/apply. The authoring worker cannot research independently, verify itself, approve/apply/publish its output, or bypass Worker Engine model authorization.

Therefore Content must be adapted through the generic contracts rather than copied into the kernel.

## Production reconstruction snapshot

Read-only production reconstruction on 2026-08-19 observed: 9 workforce identities, 9 objectives, 9 plans, 27 plan steps, 27 capability-authority grants, 18 execution budgets, 17 task contracts, 18 workforce runs, 421 HQ automation runs, 1 dead letter, 1 HQ finding, 0 HQ decisions, 0 HQ artifacts, 0 execution intents, 0 execution verifications and 0 task verifications.

The zero verification/intents counts are historical/live usage evidence, not proof the repository lacks the schema. Repository truth already contains execution-intent, verifier-assignment, verification, outcome, compensation and forensic contracts. The convergence requirement is to make those contracts canonical and prevent any future consequential execution path from bypassing them.

## Safety state

This Autopilot line is NON-ACTIVATING. Production Supabase remains read-only for this task. Repository promotion must not enable runtime, heartbeat, Factory, Shadow, autonomy, risk, capability authority, publication, external communication, M-Pesa or production mutation.

## Collision policy

Upstream shared-foundation work owns domain truth. Autopilot owns only the generic orchestration contract. Shared concepts receive compatibility tests; duplicate architectures are forbidden. Before promotion this branch must reconcile against exact-current `main` and re-run the full affected contract set.
