# WE-R1.3X X0 — Legacy Reconciliation Map

Date: 2026-08-15
Gate: X0 Archaeology and Freeze
Status: COMPLETE — architecture/dependency gate only; no runtime activation
Baseline: main @ f4039230724b95a8c55c1dbf8e95cb0726f8ea74

## Purpose

Freeze the safety foundation and classify the current Worker Engine before R1.3X schema evolution. This map is deliberately conservative: historical migrations remain immutable and no legacy entrypoint is deleted merely because its intelligence model will be superseded.

## Canonical invariants frozen at X0

- Exactly one Worker Engine: the existing `hq_workforce_*` control plane.
- Authority, lifecycle/revocation, RLS, identity boundaries, certification separation, bounded budgets, immutable evidence, independent verification, global stop, anomaly pause, migration-ledger evidence and production/repository promotion separation are retained.
- `heartbeat_enabled=false`, `factory_enabled=false`, consequential runtime disabled, autonomy L0/R0 remain reconciliation assumptions.
- Shadow and production activation are separate owner-gated concerns and are not part of X0–X9 implementation.
- Historical production migrations are evidence/lineage and are never rewritten.

## Dependency domains and reconciliation classification

| Domain / primitive | Current role | Classification | Successor / treatment | Retirement precondition |
|---|---|---|---|---|
| `hq_workforce_engine_contract` | singleton mission + runtime safety contract | KEEP + EXTEND | remains top-level safety/config contract; add R1.3X feature gates only when needed | never retire |
| `hq_workforce_workers` | worker identity, department, status, competencies, permissions | KEEP + EXTEND | identity/lifecycle stays; normalized competency graph augments JSON competencies | competency parity + consumer migration before legacy JSON becomes compatibility-only |
| `hq_workforce_roles` | static role definitions | KEEP | organizational/job design metadata | none planned |
| `hq_workforce_jobs` | job catalogue | KEEP + ADAPT | jobs become implementation units beneath objective/plan steps | never remove until all consumers understand plan relationship |
| `hq_workforce_assignments` | worker-role assignment | KEEP + ADAPT | retain HR/ownership semantics; do not use as universal planning primitive | none planned |
| `hq_workforce_lanes` | organizational lane + owner/schedule metadata | KEEP as metadata | remove hard-routing semantics; lane may constrain policy/scope only when explicitly required | all routing/scheduler consumers migrated |
| `hq_workforce_skills` / skill manifests | versioned procedures/certification | KEEP + EXTEND | skills implement capabilities; certification remains independent | never replace certification with capability assertion |
| contract/authority clauses | policy and authority boundaries | KEEP permanently | feed planner/resolver as hard constraints | never retire without stronger policy engine |
| gap signals/evaluations | workforce/gap diagnosis | ADAPT | become one input to capability-demand diagnosis; cannot directly imply worker demand | X8 factory reconciliation certified |
| learning candidates | candidate institutional learning | KEEP + EXTEND | Memory Fabric ingestion path with typed provenance and promotion rules | X2/X9 parity |
| outcome verifications | independent verification | KEEP + EXTEND | bind to objectives/plans/steps in addition to assignments | never remove independent verification |
| decisions / R1.3 shadow decisions | human review | KEEP + CONSOLIDATE | Decision Inbox gains objective/plan/evidence lineage; no duplicate decision control plane | unified decision projection certified |
| evidence / traces / shadow events | immutable reasoning evidence | KEEP + EXTEND | carry objective, plan, capability, resource and calibration lineage | never weaken immutability/provenance |
| R1.3 shadow candidates | open-work candidate primitive | ADAPT / COMPATIBILITY | objective detector consumes source work; candidate remains compatibility projection | X1+X7 comparative parity |
| `hq_workforce_run_shadow_cycle` | safe open-work scanner + queue ceilings | KEEP SAFETY SHELL / SUPERSEDE INTELLIGENCE | X7 orchestrator retains ceilings, global stop and anomaly pause while delegating objective/planning | comparative Shadow + fail-closed tests |
| R1.3 lane-equality worker selection | selects first active worker in candidate lane | SUPERSEDE | X6 competency/capability/authority/reliability/workload router | comparative routing certification |
| R1.3 single-manifest skill selection | one certified skill for recommendation | ADAPT | X3/X5 capability composition resolves one or more certified procedures | capability composition certification |
| fixed recommendation confidence (`0.9000`) | nominal confidence | SUPERSEDE | X9 calibrated prediction backed by outcome history/sample size | calibration suite certified |
| `lib/hq/workforce/router.ts` | deterministic department/competency first-match router | COMPATIBILITY / SUPERSEDE | X6 scored router; legacy result retained in comparative Shadow evidence | TypeScript consumers migrated + comparative suite |
| WE-L3 Shadow certification | execution safety precursor | KEEP + INTEGRATE | remains regression boundary under R1.3X | never retire without stronger equivalent |
| WE-L4 heartbeat/scheduler | worker-era autonomous scheduling | COMPATIBILITY / RETIRE-LATER | X7 intelligence orchestrator; heartbeat stays OFF | X7 certification + explicit retirement decision |
| WE-L5 model gateway | deterministic-first model boundary | KEEP + EXTEND | register as governed resource/provider under X4 | none planned |
| WE-L6 reference worker/loop | safety proof fixture | KEEP AS REGRESSION FIXTURE | not canonical intelligence proof | may remain indefinitely as regression fixture |
| WE-L7 Factory V2 | worker creation lifecycle | KEEP MECHANICS / SUPERSEDE DECISION INPUT | X8 last-resort factory consumes proven capacity gaps only | X8 parity/adversarial certification |
| WE-L8 autonomous demand factory | demand→factory interpretation | COMPATIBILITY / RETIRE-LATER | capability-demand diagnosis | X8 certified and Factory still OFF |
| WE-L9 autonomous qualification/dispatch | autonomous worker-era routing | SUPERSEDE ROUTING | X6/X8 governed competency routing and probation semantics | X6+X8 certification |
| WE-L10 reuse hardening | reuse-before-create | KEEP PRINCIPLE + EXTEND | resolver checks capability/resource/collaboration/skill/rebalance before Factory | X8 embeds expanded chain |
| WE-L11 demand sensor | workforce demand sensing | ADAPT | objective/capability demand signal; cannot itself establish worker need | X1/X8 certification |
| WE-L12 single governed entrypoint | bypass closure | KEEP permanently | all R1.3X orchestration enters governed control path | never retire |
| WE-L13 autonomous Factory architecture | safe but worker-demand-centric factory control | COMPATIBILITY / RETIRE-LATER | X8 factory recommendation boundary | X8 certification + explicit retirement decision |
| R1.2 runtime policy kernel | production authority/safety kernel | KEEP permanently | hard constraint for every future runtime | never retire without stronger formally reviewed replacement |
| R1.3 resource/anomaly governance | shadow quotas, queue/concurrency/anomaly controls | KEEP + EXTEND | X4/X7 consume same ceilings | never weaken |
| R1.3 Control Room | operational observability | KEEP + EXTEND | add objective/plan/capability/resource/calibration views | UI parity and security tests |
| R1.3 acceptance/promotion workflows | evidence gates | KEEP + EXTEND | add R1.3X gates; do not bypass | never remove protected promotion discipline |

## Confirmed architectural collision points

### A. Department equality is encoded in more than one layer

The TypeScript router filters by exact `departmentKey`. R1.3 recommendation selection independently selects an active worker where `department_key = candidate.lane_key`. Therefore fixing only one router would leave lane rigidity alive elsewhere. X6 must replace the routing contract, not one function.

### B. Candidate discovery inherits lane semantics

R1.3 candidate discovery derives candidate lane from the source work item's department. X1 must introduce objective identity above this projection; X7 later changes scheduler orchestration. Until then the candidate path remains compatibility-only and non-consequential.

### C. Skill certification is strong; skill selection abstraction is narrow

Existing certification/versioning/authority checks are retained. The defect is not certification—it is treating one selected skill as the planning unit. X3 introduces capabilities above skills and X5 composes capabilities/procedures into plans.

### D. Factory mechanics and Factory intelligence must be separated

Existing Factory lifecycle/security mechanics are useful. Existing demand interpretation is not sufficient to prove a worker gap. X8 preserves safe mechanics while replacing the decision chain with exhaustive reuse/composition/resource/collaboration/capacity diagnosis.

### E. Confidence currently lacks calibration semantics

R1.3 recommendation confidence is fixed in the current path. It must not be interpreted as empirical reliability. X9 replaces this with outcome-calibrated confidence while preserving historical evidence.

## Consumer map requiring migration awareness

1. Database: `hq_workforce_*` tables/functions/policies/grants/triggers and R1.2/R1.3 runtime contracts.
2. TypeScript: `lib/hq/workforce/*`, especially `router.ts` and worker definitions/types.
3. HQ UI: `app/hq/workforce/page.tsx` and Control Room RPC consumers.
4. Tests: WE-L* regression fixtures, R1.2 runtime-policy tests, R1.3 shadow-governance tests, reference loop.
5. CI/promotion: R1.2 acceptance, R1.3 acceptance, R1.3 production-promotion and production verification scripts.
6. Documentation: canonical authority, production readiness/certification, autonomous Factory lineage, governed Shadow operations and this R1.3X mission.

## X0 exit evidence

- Canonical engine identity confirmed and frozen.
- Core model lineage inspected: roles, jobs, workers, assignments, engine contract.
- OS-v2 lineage inspected: lanes, skills, gaps, learning, verification, decisions.
- Current TypeScript router inspected and classified.
- Factory lineage located across WE-L7/L8/L9/L10/L11/L12 and associated tests.
- R1.2 runtime policy and R1.3 Shadow/scheduler/control-room/promotion surfaces located and frozen as safety dependencies.
- Known architectural collision points documented with successor gates.
- No production/runtime flag changed.
- No historical migration edited.
- No legacy primitive deleted.

## Gate decision

X0: PASS.

Next allowed gate: X1 Objective Kernel.

X1 must be additive and non-activating. It may introduce objective contracts and compatibility relationships, but it may not replace scheduler/routing/Factory behavior yet.