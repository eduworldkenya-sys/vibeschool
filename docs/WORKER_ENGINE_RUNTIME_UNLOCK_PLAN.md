# Worker Engine Runtime Unlock Plan

Updated: 2026-08-13
Mission: **WE-R1 — Worker Engine Controlled Runtime Certification**
Status: PROPOSAL / CERTIFICATION PLAN ONLY — NO RUNTIME ACTIVATION AUTHORIZED

## Operating rule

The completed production migration mission proves the Worker Engine foundation is installed and secured. It does **not** prove that autonomous workers make correct production decisions.

Runtime unlocking is therefore performed one capability at a time:

`Verified infrastructure -> Shadow mode -> Supervised execution -> Limited autonomy -> Measured expansion`

For every item:

1. create a fresh branch from current `main`;
2. inspect current production/repository state;
3. implement only that item;
4. run targeted regression/security tests;
5. run TypeScript/ESLint/Next.js production build where applicable;
6. review blast radius and authority change;
7. merge only when evidence is green;
8. verify resulting state;
9. update logs;
10. only then begin the next item.

No item may silently enable later stages.

## Current locked production state

- Worker Engine production schema: VERIFIED
- certified Worker Engine migrations: 22/22 present
- promoted Worker Engine tables verified: 21
- promoted Worker Engine function names verified: 52
- heartbeat switch: OFF
- factory switch: OFF
- Worker Engine cron heartbeat: ABSENT
- autonomous runtime: OFF
- automatic worker creation: OFF
- production verification mode: `READ_ONLY_PRODUCTION_VERIFY`
- production verification DDL: false
- production verification DML: false
- autonomous activation during verification: false

This is the safety baseline. Every runtime-unlock item must preserve it unless that specific item explicitly authorizes a narrower change.

## Autonomy ladder

- **L0 — Disabled:** nothing runs autonomously.
- **L1 — Observe:** approved facts may be inspected and work may be detected; no consequential mutations.
- **L2 — Recommend:** jobs/actions may be proposed and recorded; consequential execution requires approval.
- **L3 — Reversible low-risk execution:** only explicitly certified, reversible, low-risk procedures may execute automatically inside hard limits.
- **L4 — Bounded operational autonomy:** certified workers may execute only within explicit scope, budget, rate, concurrency and authority boundaries; sensitive/high-impact actions remain approval-gated.

Full unrestricted autonomy is not a target.

## Shadow-mode contract

Before L3, workers may detect work, create candidate jobs, select a proposed worker and certified skill/procedure, calculate priority and SLA, produce proposed actions, record evidence/reasoning, predict expected outcomes, identify missing workers/skills, and escalate uncertain or high-risk decisions to the Decision Inbox.

They may not perform consequential production mutations merely because they proposed an action.

`Worker proposes -> system records -> human/system verifier evaluates -> consequential execution remains blocked`

## Authority is the hard boundary

Worker reasoning never grants execution authority.

Every consequential path must preserve:

`Worker -> Skill -> Authority check -> Policy -> Scope -> Risk -> Approval requirement -> Execute -> Verify -> Audit`

Workers cannot promote their own authority, bypass approval, or certify their own outcomes.

## Skill certification contract

Every consequential skill/procedure must be versioned and declare at least purpose, required inputs, allowed tables/functions/tools, preconditions, authority level, maximum blast radius, expected output, verification procedure, rollback/compensation strategy, timeout, retry policy, escalation conditions, owner, version and certification status.

**Uncertified skill = cannot execute autonomously.**

## Required circuit breakers before scheduling

Before any production heartbeat is enabled, WE-R1 must prove or implement:

- global kill switch;
- per-lane switch;
- per-worker switch;
- per-skill switch;
- rate limits;
- budget limits;
- retry ceilings;
- concurrency ceilings;
- anomaly breaker / automatic pause thresholds.

A worker, lane, or skill must fail closed when its applicable boundary is disabled or exceeded.

## Runtime observability / Control Room contract

HQ must be able to answer what the digital workforce is doing now. Minimum visibility is:

`Workers -> Jobs -> Decisions -> Executions -> Evidence -> Failures -> Costs -> Authority -> Health`

At minimum expose active/disabled workers, queued/running/completed/failed jobs, approval waits, execution latency, retries, authority denials, worker/skill versions, anomalies, audit trail, heartbeat status, factory status and emergency-stop state.

## Initial certification thresholds

| Measure | Initial requirement |
|---|---:|
| Correct worker selection | >=95% |
| Correct skill/procedure selection | >=95% |
| Unauthorized actions | 0 |
| Cross-lane authority violations | 0 |
| Cross-school/user data leakage | 0 |
| Unexplained actions | 0 |
| Duplicate jobs | Near zero |
| Failed/retry loops | Bounded |
| Human escalation when required | 100% |
| Evidence attached to consequential decisions | 100% |

A threshold failure blocks promotion of the affected capability.

## Controlled runtime sequence

### WE-R1.1 — Runtime Authority & Kill-Switch Audit

Inventory current authority and execution entrypoints; prove global OFF behavior; identify lane/worker/skill controls; define concurrency, retry, budget and rate-limit contracts; test privilege escalation and bypass attempts. No heartbeat, factory, cron or autonomous execution is enabled.

### WE-R1.2 — Missing Circuit Breakers

Implement only controls proven missing by WE-R1.1. No scheduler activation.

### WE-R1.3 — Runtime Observability / Control Room

Establish operator visibility for workers, jobs, decisions, executions, evidence, failures, costs, authority, health and emergency stop. No autonomous production mutation.

### WE-R1.4 — Shadow Scheduler

Allow scheduled observation/recommendation only. Workers may detect, classify, propose and record candidate work under certified authority; consequential production mutations remain blocked.

### WE-R1.5 — Production Shadow Certification Window

Measure worker selection, skill selection, authority denials, duplicate jobs, escalation, evidence completeness, retry behavior and cross-lane/cross-school isolation against the formal thresholds above. No transition to execution from this item alone.

### WE-R1.6 — First Reversible Low-Risk Capability

Select exactly one certified, reversible, low-risk procedure for supervised/bounded production execution with explicit authority, verification, rollback/compensation, rate, budget and concurrency limits.

### WE-R1.7 — Bounded Runtime Expansion

Expand only when the previous capability meets its production evidence threshold. Each additional capability remains separately certified.

### WE-R1.8 — Worker Factory Recommendation Mode

The Factory may detect a workforce gap and propose a worker specification, but cannot automatically create or activate a production worker.

### WE-R1.9 — Governed Factory Probation

Only after worker execution is stable may factory-created workers stop at SHADOW/probation and undergo independent human/governance certification before authority is provisioned.

Broad self-expanding autonomy is not implied or targeted.

## Permanent principles

- intelligence does not imply authority;
- uncertified skill means no autonomous execution;
- irreversible/high-impact actions remain human-gated;
- workers cannot grant themselves authority;
- workers cannot certify themselves;
- factory cannot silently activate its own workers;
- every consequential action must be auditable and independently verifiable;
- failure loops must be bounded;
- global emergency stop must remain available;
- runtime activation and worker-factory activation remain separate decisions;
- activate individual capabilities only after each capability earns production authority.

## Worker Factory boundary

The Worker Factory remains disabled during initial WE-R1 runtime certification. Existing workers are proven first.

The first permitted factory progression is recommendation mode only:

`detect gap -> propose worker -> generate specification -> human approval -> probation -> certification -> activation`

Automatic creation/activation is not authorized by this plan.

## Next item

**WE-R1.1 — Runtime Authority & Kill-Switch Audit**

This is the only next implementation item authorized by this plan after documentation reconciliation is merged and verified. It must preserve:

```text
heartbeat_enabled=false
factory_enabled=false
Worker Engine production cron heartbeat=0
autonomous runtime=OFF
```
