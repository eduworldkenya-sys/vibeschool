# Vibeschool Worker Engine — State, Gap & Completion Log

**Status:** Active engineering control log  
**Established:** 2026-08-12  
**Canonical engine:** `hq_workforce_*` + Worker Engine governance architecture  
**Authority:** Complements `docs/WORKER_ENGINE_CANONICAL.md`; does not create a second engine.

## 1. Purpose

This is the durable handoff document for the Worker Engine. A future engineer or AI agent should read this before re-investigating the subsystem.

It records:

- the intended autonomous workforce loop;
- what is proven to exist in repository/production;
- what existing terms such as `active`, `completed`, and `schedule_keys` actually mean;
- implementation gaps discovered by runtime audit;
- safety invariants that must not be weakened; and
- the next ordered implementation sequence.

## 2. North-star contract

The Worker Engine is intended to autonomously:

```text
OBSERVE COMPANY SIGNALS
  -> DETECT WORK / CAPACITY / SKILL / POLICY / TOOL GAPS EARLY
  -> DIAGNOSE ROOT CAUSE
  -> PREFER PROCESS REPAIR / AUTOMATION / TRAINING / REBALANCING
  -> IF A NEW WORKER IS JUSTIFIED, GENERATE A GOVERNED WORKER BLUEPRINT
  -> PROVISION IN SHADOW / PROBATION
  -> CERTIFY AGAINST REAL OUTCOME AND SAFETY TESTS
  -> ACTIVATE WITH BOUNDED, REVOCABLE AUTHORITY
  -> ASSIGN REAL WORK
  -> EXECUTE CERTIFIED SKILLS THROUGH GOVERNED GATEWAYS
  -> CAPTURE EVIDENCE
  -> INDEPENDENTLY VERIFY OUTCOMES
  -> RECOVER / ESCALATE / SUSPEND ON FAILURE
  -> LEARN ONLY FROM VERIFIED OUTCOMES
  -> PROMOTE SKILLS OR ROLLBACK
  -> REBALANCE / REMEDIATE / RETIRE WORKERS
  -> LOOP
```

Autonomy means autonomous operation **inside constitutional limits**. The engine may not invent authority merely because it can create a worker.

## 3. Canonical one-engine state

Vibeschool has one Worker Engine. The existing HQ workforce implementation is its runtime foundation. The architecture-freeze material is the hardening/completion specification, not Worker Engine 2.

Historical Worker Engine branches are lineage/evidence unless explicitly promoted. Do not revive a stale historical branch as a parallel control plane.

## 4. Production inventory verified 2026-08-12

Runtime inspection confirmed a substantial production foundation.

### 4.1 Active workforce

10 active digital workers / lanes were observed:

1. Curriculum Intelligence
2. Finance Operations
3. Growth
4. Operations
5. Product Quality
6. Publishing Operations
7. School Success
8. Security
9. Support Operations
10. Workforce Intelligence

All inspected workers use deterministic reasoning and have `paid_ai_allowed = false`.

### 4.2 Workforce objects

Production contains the canonical workforce structures for workers, roles, jobs, assignments, lanes, skills, worker-skill bindings, worker certifications, runs, decisions, gap signals/evaluations, HR diagnoses, evidence qualification, outcome verification, recovery, monitoring, handoffs, correction events, memory, learning candidates, skill promotion/rollback, security events and engine contract clauses.

All inspected `hq_workforce_*` tables have RLS enabled. Ordinary `anon`/`authenticated` table access is not the worker execution model. Workforce control functions are predominantly service-role-only. Owner-facing decision functions are authenticated but enforce HQ owner authority internally.

## 5. What is genuinely implemented

### 5.1 Registry/control-plane capabilities — REAL

- worker/role/assignment registry;
- lane ownership;
- versioned skills and worker-skill relationships;
- context scopes and authorization helpers;
- deterministic gap detection/diagnosis;
- probation-worker creation;
- worker certification records;
- work routing and run records;
- human decision inbox with approve/revise/reject/skip;
- evidence and outcome-verification records;
- recovery planning;
- cross-lane handoffs;
- correction capture;
- institutional memory;
- learning candidates;
- skill probation, promotion and rollback;
- security events;
- structural runtime self-certification;
- HQ Workroom surfaces for work, evidence, runs, handoffs and owner actions.

### 5.2 Gap diagnosis — REAL AND DETERMINISTIC

The current diagnosis logic intentionally does not equate every problem with a new hire. It distinguishes conditions including:

- missing ownership -> assign existing or create worker;
- missing skill -> train existing worker;
- tool/automation failure -> repair system;
- routing defect -> repair routing;
- capacity pressure -> rebalance before adding capacity;
- policy/enforcement gap -> repair policy/enforcement;
- quality failure -> root-cause/process repair;
- verification backlog -> drain/reassess;
- content backlog -> prioritize/reassess;
- SLA breach -> triage/rebalance;
- incident pressure -> recover and inspect recurring cause;
- unknown -> human diagnosis.

**Invariant:** diagnose before staffing.

### 5.3 Worker Factory — PARTIALLY REAL

`hq_workforce_create_probation_worker(...)` can create a digital probation worker, create/update its role, assignment and worker-skill relationship, and requires an active unowned lane with a certifiable skill.

This proves worker generation exists, but it is Worker Factory V1, not the final autonomous factory.

### 5.4 Verification — REAL

`hq_workforce_verify_run(...)` requires a completed, authorized run plus expected outcome, actual outcome, verification method and independent evidence. A run becomes `verified` only when execution is certified and expected equals actual.

**Invariant:** execution is not success; verified outcome is success.

### 5.5 Learning — REAL BUT EARLY

The engine contains correction events, learning candidates, positive evidence, skill promotion, probation benchmarks and rollback. Skill promotion requires execution pass plus outcome verification; failure rolls the proposed skill back.

**Invariant:** workers learn from verified evidence, not raw activity.

## 6. Critical semantic corrections from runtime audit

These corrections prevent future engineers from overestimating the current system.

### 6.1 `active` does not yet mean fully certified autonomous worker

The first-generation probation certification checks configuration conditions such as paid-AI disabled, assignment present, certified lane skill present and context scope present. Passing these can promote `probation -> active`.

That is useful configuration certification, but it does not yet prove competence through shadow workloads, adversarial tests, recovery tests, capability/budget enforcement and repeated independently verified outcomes.

Until lifecycle convergence is completed, interpret current `active` as **legacy operationally enabled**, not Architecture-Freeze-V1 fully certified.

### 6.2 `completed` does not necessarily mean the business outcome occurred

The generic `hq_workforce_execute_safe_queue()` currently moves authorized queued runs through `running -> completed` while recording a deterministic `triage_and_own` action and updating work ownership metadata.

It does not constitute a universal executor for the underlying Finance, Publishing, Security, Support, School Success, Growth or Curriculum operation.

Therefore the current runtime is stronger at **orchestration/control** than at universal business-operation execution.

### 6.3 `schedule_keys` are declarative today

Lanes declare cadences such as `continuous`, `hourly`, `daily`, and `weekly`, but the 2026-08-12 production audit found no Worker Engine pg_cron jobs. Workforce triggers observed on runs/verifications synchronize traces rather than constitute a complete event/schedule consumer.

Therefore the engine does not yet have a proven continuously turning autonomous heartbeat.

### 6.4 Runtime self-certification is structural health certification

Existing runtime self-certification checks useful structural conditions: context sources, fact definitions, lane ownership, active owners, paid-AI disabled, authority gating, memory seeding and decision/run consistency.

It must not be interpreted as proof that every worker can correctly execute its departmental mandate.

## 7. Current structural gaps

### GAP-01 — No canonical continuous heartbeat

Needed:

```text
detect -> diagnose -> route -> authorize -> execute -> verify -> recover/escalate -> learn -> repeat
```

Current components exist but are not yet proven as one continuously scheduled/event-driven loop.

### GAP-02 — Execution kernel is shallow

The generic executor performs orchestration/ownership. The engine still needs a certified skill dispatcher that performs actual deterministic operations.

### GAP-03 — Worker lifecycle is too simple

Target lifecycle:

```text
PROPOSED
-> REQUESTED
-> INSTANTIATED
-> PROVISIONED
-> SHADOW
-> CERTIFICATION_PENDING
-> CERTIFIED
-> ACTIVE
-> SUSPENDED / REMEDIATION
-> RETIRED
-> ARCHIVED
```

Transitions must be engine-controlled and audited.

### GAP-04 — Capability enforcement is not normalized

Current JSON `permissions`/`approval_boundaries` are useful declarations but not the final enforcement primitive.

Needed capability contract:

```text
worker + operation + resource/scope + grantor + validity window + revocation + policy version
```

### GAP-05 — No canonical worker revocation primitive

Privileged execution must fail if worker/capability/credential authority has been revoked.

### GAP-06 — Worker execution budgets are incomplete

Need transactional limits for compute/tool calls/model tokens/financial or other exposure/time. Exhausted budget must fail closed.

### GAP-07 — Tool Gateway incomplete

Workers should not directly mutate arbitrary systems. Every external or privileged action must pass:

```text
identity -> lifecycle -> task -> capability -> scope -> budget -> tool policy -> execution -> audit
```

### GAP-08 — Model Gateway incomplete

Any future AI usage must be governed by allowed provider/model/class, task association, token budget, prompt/response evidence/hash where appropriate, and verification requirements. AI output may not create authority.

### GAP-09 — Tamper-evident audit chain incomplete

Append-only records exist, but the target architecture requires a stronger immutable/tamper-evident serialized audit contract for privileged worker actions.

### GAP-10 — Universal verification adoption incomplete

Verification machinery is strong, but every meaningful run must terminate in a governed outcome such as `verified`, `failed`, `decision_required`, or `recovery`; `completed` must not become a success shortcut.

### GAP-11 — Workforce planning is heuristic

Gap diagnosis should evolve to use measured throughput, utilization, SLA trend, recurrence, skill overlap, failure/recovery rate, verification backlog, handoff cost, seasonality and cost/risk before creating capacity.

### GAP-12 — Worker Factory V2 incomplete

Factory V2 must generate the complete worker contract:

```text
Blueprint + Identity + Role + Skills + Capabilities + Context + Tools + Budgets + KPIs + Approval Boundaries + Certification Plan + Expiry/Review
```

### GAP-13 — Elastic capacity not implemented

Current probation-worker creation is oriented around an unowned lane. The future factory must support justified additional capacity in an already-owned lane without confusing lane accountability with worker count.

### GAP-14 — Job catalogue is incomplete

Production has 10 lanes/workers but only five canonical lane jobs were observed. Finance, Publishing, School Success, Support and Workforce Intelligence workers currently lack normalized `job_key` assignments in the same pattern as the original five.

### GAP-15 — Monitoring is too narrow

Current monitoring primarily detects stuck queued/running runs. Expand to failures, recovery loops, verification/decision backlog, capability/credential expiry, budget pressure, access denials, context degradation, policy violations, queue starvation, worker overload and dead-letter accumulation.

### GAP-16 — Dead-letter / contract-version rejection incomplete or unproven

Unknown or incompatible task/tool/skill contracts must never be silently accepted. They need explicit rejection/dead-letter handling and replay evidence.

### GAP-17 — HQ Workroom is not yet a full Worker Control Center

Workroom coordinates work. A worker console should expose lifecycle, current task/queue, skills, capabilities, budgets, certification, last verified outcomes, health, failures/recovery, context scope, suspension and revocation.

### GAP-18 — Scope model requires explicit global-vs-school classification

Do not blindly add `school_id` to every workforce object. Classify each contract as platform-global or tenant/school-scoped, then enforce school scope wherever the worker can act on tenant data.

## 8. Architecture completion model

The canonical engine should converge to:

```text
COMPANY SIGNAL / EVENT BUS
        |
CONTEXT ENGINE
        |
WORKFORCE INTELLIGENCE
        |
  +-----+----------------------+------------------+
  |                            |                  |
PROCESS/AUTOMATION FIX     SKILL NEEDED       WORKER NEEDED
  |                            |                  |
AUTOMATION                 SKILLS ENGINE      WORKER FACTORY
  +----------------------------+------------------+
                               |
                         WORKER BLUEPRINT
                               |
                    IDENTITY + LIFECYCLE
                               |
                    SHADOW + CERTIFICATION
                               |
                         ACTIVE WORKER
                               |
                 AUTHORITY + CAPABILITY
                               |
                      BUDGET CONTROLLER
                               |
                         TASK ROUTER
                               |
                    CERTIFIED SKILL ENGINE
                               |
                         TOOL GATEWAY
                               |
                          REAL ACTION
                               |
                           EVIDENCE
                               |
                    VERIFICATION ENGINE
                               |
           +-------------------+------------------+
           |                   |                  |
        VERIFIED             FAILED            DECISION
           |                   |                  |
         MEMORY             RECOVERY             HQ OWNER
           |                   |
        LEARNING          REMEDIATION
           |                   |
   SKILL PROMOTION       RECERTIFY/RETIRE
           |                   |
           +--------- WORKFORCE INTELLIGENCE ----+
```

## 9. Ordered next implementation sequence

Do not add more workers merely to increase worker count. Complete the kernel first.

### WE-L1 — Contract convergence

Map existing production/repository objects to:

- WorkerRecord
- Blueprint
- Identity
- Lifecycle
- Capability
- Task
- Budget
- Context
- Skill
- Tool
- Verification
- Audit

Classify platform-global versus school-scoped contracts. Reuse existing objects before adding DDL.

### WE-L2 — Identity, lifecycle and revocation

Introduce the canonical state machine and revocation checks without breaking legacy workers. Existing `active` workers should enter a documented transitional/grandfathered state until recertified under the stronger contract.

### WE-L3 — Capability and budget enforcement

Convert descriptive permissions into mechanically enforced, scoped, time-bound, revocable capabilities. Add transactional execution budgets.

### WE-L4 — Tool Gateway

Create one governed boundary for privileged/external execution. No worker bypass.

### WE-L5 — Real deterministic skill execution

Replace `triage_and_own` as the practical endpoint with a dispatcher to certified deterministic skill implementations. Keep orchestration as a valid skill, not as a false proxy for business completion.

### WE-L6 — Universal verification, recovery and DLQ

Make every meaningful execution converge to verified/failed/decision/recovery. Add contract-version rejection and dead-letter/replay handling.

### WE-L7 — Event bus / scheduler heartbeat

Materialize lane event/schedule definitions into a real, observable, idempotent engine loop.

### WE-L8 — Reference Operations Worker certification

Use Operations Worker as the first full vertical slice:

```text
signal
-> task envelope
-> identity/lifecycle
-> capability/context/budget
-> certified skill
-> tool gateway
-> real deterministic action
-> evidence
-> independent verification
-> memory/health update
```

Run shadow, adversarial, recovery and boundary tests before declaring it fully certified.

### WE-L9 — Worker Factory V2 / Workforce Intelligence V2

After the execution kernel is proven, allow the engine to propose and generate workers based on measured need. It must prove process repair, automation, training and rebalancing were considered first.

### WE-L10 — Controlled autonomy expansion

Apply the proven reference contract to Security, Product Quality, Publishing, School Success, Support, Finance, Curriculum Intelligence, Growth and Workforce Intelligence.

## 10. Definition of Done — autonomous Worker Engine

The Worker Engine is not complete merely because workers exist or runs can be created.

It is complete when Vibeschool can, under bounded constitutional authority:

1. continuously observe relevant company signals;
2. detect a workforce need early;
3. diagnose the root cause;
4. prefer repair/automation/training/rebalancing where appropriate;
5. prove when a new worker is justified;
6. generate a complete governed worker contract;
7. shadow-test and certify the worker;
8. activate it with bounded, revocable capabilities and budgets;
9. assign and execute real certified work through governed gateways;
10. capture evidence and independently verify outcomes;
11. recover, suspend, remediate or retire on failure;
12. learn only from verified outcomes; and
13. do the above without routine owner intervention, escalating only novel authority, high-risk policy/financial/security decisions and genuine uncertainty.

## 11. Safety invariants

1. One Worker Engine; no parallel control plane.
2. Diagnose before staffing.
3. Worker creation does not create authority.
4. No worker self-grants authority.
5. No privileged action without identity, valid lifecycle, task, capability, scope and budget.
6. No direct tool/model bypass around governed gateways.
7. Execution is not success; verification is success.
8. Learning requires verified evidence.
9. Unknown contract/version/scope fails closed.
10. Revocation/suspension must take effect before the next privileged action.
11. Tenant/school data must be explicitly scoped where applicable.
12. High-risk or novel authority escalates to the owner/governance boundary.

## 12. Progress interpretation

As of this audit:

- workforce registry/control foundation: strong;
- orchestration/governance: substantial;
- autonomous continuous heartbeat: incomplete;
- universal real task execution: incomplete;
- lifecycle/capability/revocation/budget gateways: incomplete;
- verification/learning primitives: strong but not universally adopted;
- full governed autonomous Worker Engine: not yet certified complete.

Do not use a single percentage as release evidence. Completion is gate-based and must be demonstrated by the end-to-end reference-worker certification.

## 13. Change log

### 2026-08-12 — Deep runtime audit incorporated

**Finding:** One-engine convergence is real and production contains a broad `hq_workforce_*` foundation.

**Finding:** The generic safe-queue executor currently performs deterministic `triage_and_own` orchestration rather than universal departmental business execution.

**Finding:** Worker generation exists through probation-worker creation, but Worker Factory V2 and elastic capacity planning remain incomplete.

**Finding:** Existing `active` worker status is based on first-generation certification and must not be treated as proof of Architecture-Freeze-V1 full autonomous certification.

**Finding:** Strong independent outcome-verification and learning rollback primitives exist and should become universal gates.

**Finding:** Lane schedule/event declarations are not yet proven as a continuously running Worker Engine heartbeat; no Worker Engine pg_cron jobs were found during production inspection.

**Finding:** Production access posture for inspected workforce objects is fail-closed for ordinary clients; owner decision RPCs retain explicit HQ owner checks.

**Decision:** Resume Worker Engine work by completing the execution/governance kernel, not by creating more workers or another architecture.

**Next milestone:** `Worker Engine Autonomous Governance Loop`, beginning with WE-L1 contract convergence and ending with one fully certified Operations Worker vertical slice before broad autonomy expansion.
