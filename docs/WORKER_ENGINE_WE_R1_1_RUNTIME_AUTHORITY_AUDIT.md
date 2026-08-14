# Worker Engine WE-R1.1 — Runtime Authority & Kill-Switch Audit

Updated: 2026-08-14
Status: AUDIT COMPLETE — REMEDIATION REQUIRED BEFORE SHADOW SCHEDULING
Branch baseline: `d4b542dd123beade57ffef23110aa2f01d15cfee`

## Mission

Prove the existing Worker Engine runtime cannot gain consequential production authority merely because the schema is installed, and identify the minimum hardening required before any L1/L2 shadow scheduler is permitted.

This audit does not authorize runtime activation.

## Preserved production boundary

The production-promotion separation migration forces `heartbeat_enabled=false`, `factory_enabled=false`, removes the Worker Engine cron heartbeat, and revokes legacy probation create/certify entrypoints. WE-R1 must preserve those controls until an explicit later activation gate.

## Existing controls confirmed

The repository already contains substantial safety infrastructure:

- one canonical Worker Engine and control plane;
- worker lifecycle states including shadow, certification, active, suspended and retired;
- expiring worker identities and identity revocation;
- expiring capability grants;
- execution budgets with reservation/consumption semantics;
- worker certification checks;
- task/tool contracts and allowlisted tool handlers;
- task scope equality checks in the tool gateway;
- task idempotency keys and bounded attempts;
- immutable shadow evidence and task verification evidence;
- heartbeat/factory OFF switches;
- promotion-time cron removal;
- service-only direct access for Worker Engine control tables/functions.

These controls are valuable and must be extended, not duplicated.

## Critical findings

### F1 — Global OFF switch is not a universal execution guard

`heartbeat_enabled` currently gates the scheduled heartbeat path. It does not itself gate direct invocation of lower-level service-role execution functions such as the autonomous heartbeat or task queue/tool gateway.

Therefore the current switch is a scheduler switch, not yet a universal runtime kill switch.

**Required:** every consequential execution entrypoint must call one fail-closed runtime authorization function before mutation.

### F2 — No explicit lane/worker/skill circuit-breaker hierarchy

Worker lifecycle suspension/revocation can disable a worker, and tool contracts can be revoked, but there is no single policy hierarchy resolving:

`global -> jurisdiction -> tenant -> lane -> worker -> skill -> execution`

**Required:** introduce explicit runtime policy state and resolve effective authority as the most restrictive applicable policy.

### F3 — Capability assertion does not independently enforce scope

`hq_workforce_assert_capability(...)` checks identity, lifecycle and capability tuple but does not accept or verify requested scope. The tool gateway later performs exact scope equality, which protects that path, but the lower-level capability assertion is unsafe as a reusable universal authorization primitive.

**Required:** create a scope-aware authorization primitive and make execution gateways use it.

### F4 — Active lifecycle currently implies executable worker

Existing execution gateways require lifecycle `active`. WE-R1 requires autonomy level and risk class to be separate from lifecycle. An active worker must be able to remain Observe/Recommend-only.

**Required:** explicit autonomy levels L0-L4 independent of lifecycle state.

### F5 — Skill certification is not yet a universal execution prerequisite

The repository has worker certifications and approved tool contracts, but no universal versioned skill capability manifest containing risk class, allowed data/resource classes, blast radius, verification, compensation, approval policy and certification status.

**Required:** certified skill manifest; uncertified skill must fail closed.

### F6 — Existing heartbeat can mutate production business state

The autonomous heartbeat detects operations tasks, executes the queue, and the allowlisted `work_item.triage_and_own` handler updates `hq_work_items`. This is valid for later bounded autonomy, but it is not a safe L1/L2 shadow scheduler.

**Required:** shadow scheduler must use a separate no-consequential-mutation path. Do not reuse the autonomous heartbeat as shadow mode.

### F7 — Factory qualification can promote workers to active

The existing qualification path can transition a factory worker through certification to `active`, then issue identity, capability grant and execution budget. Factory remains OFF in production, but this path is too powerful for WE-R1 shadow operations.

**Required:** factory stays disabled. Future factory recommendation/probation mode must stop before production authority provisioning.

### F8 — Missing production-grade execution ceilings

Budgets and max attempts exist, but WE-R1 still needs explicit concurrency, rate, queue-growth, workflow-depth, child-job and tenant-fairness limits, plus anomaly-triggered automatic pause.

### F9 — Missing jurisdiction/data-class policy dimension

Current scopes are platform/global/school/multi-school. International production additionally needs jurisdiction/tenant/data-class/purpose constraints so authority can be restricted by country/regulatory context and sensitive learner data class.

This is architecture hardening, not a claim that a particular jurisdiction legally requires a specific implementation.

## Required fail-closed execution chain

Every consequential operation must resolve:

`execution identity -> worker -> lifecycle -> autonomy -> tenant/jurisdiction -> lane -> skill version -> capability -> resource/data class -> scope -> risk -> approval -> budget/rate/concurrency -> execute -> verify -> evidence`

Any missing required component means DENY, not implicit allow.

## WE-R1.2 minimum remediation scope

1. Add a runtime policy/circuit-breaker contract with global, lane, worker and skill scopes; design tenant/jurisdiction dimensions without hard-coding country law.
2. Add autonomy level L0-L4 and risk class R0-R5 as independent policy dimensions.
3. Add one scope-aware, fail-closed runtime authorization function used by consequential gateways.
4. Make global OFF a universal execution guard, not only a scheduler guard.
5. Add versioned skill manifests/certification status; uncertified skills cannot execute consequentially.
6. Add concurrency/rate/retry/blast-radius ceilings and anomaly pause state.
7. Preserve the existing heartbeat and factory OFF boundary.
8. Add adversarial SQL tests proving direct gateway invocation cannot bypass the global/worker/skill/scope guards.
9. Do not create a cron job and do not enable shadow scheduling in WE-R1.2.

## Certification tests required before WE-R1.2 passes

- global stop denies every consequential gateway;
- disabled lane denies its workers while unrelated lanes remain eligible;
- suspended/disabled worker denied;
- disabled or uncertified skill denied;
- scope mismatch denied;
- cross-school/tenant attempt denied;
- expired/revoked identity denied;
- expired/revoked capability denied;
- budget exhaustion denied;
- retry ceiling bounded;
- duplicate/idempotent execution cannot duplicate effect;
- factory remains unable to self-activate while factory policy is OFF;
- heartbeat remains OFF and Worker Engine cron remains absent.

## Decision

WE-R1.1 result: **DO NOT ACTIVATE SHADOW SCHEDULING YET.**

The foundation is materially stronger than a prototype, but the scheduler switch is not yet a universal kill switch and shadow operation needs a distinct non-mutating runtime path. The next smallest safe implementation is WE-R1.2: Runtime Policy Kernel & Circuit Breakers.
