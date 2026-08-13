# Worker Engine Runtime Unlock Plan

Updated: 2026-08-13
Status: PROPOSAL ONLY — NO RUNTIME ACTIVATION AUTHORIZED

## Operating rule

Runtime unlocking is performed **one item at a time**.

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
- heartbeat switch: OFF
- factory switch: OFF
- Worker Engine cron heartbeat: ABSENT
- autonomous runtime: OFF
- automatic worker creation: OFF

This is the safety baseline. Every runtime-unlock item must preserve it unless that specific item explicitly authorizes a narrower change.

## Proposed unlock sequence

### WE-R1.1 — Runtime Authority & Kill-Switch Audit

**Purpose:** prove that production runtime authority can be stopped at global, lane, worker, skill and execution boundaries before any scheduling is enabled.

Scope:

- inventory current authority and execution entrypoints;
- verify existing global OFF switches and fail-closed behavior;
- identify whether lane/worker/skill-level disable controls already exist;
- identify missing circuit breakers;
- define maximum concurrency, retry, budget and rate-limit contracts;
- test privilege escalation and bypass attempts;
- produce the minimum safe implementation plan for missing controls.

This item is primarily audit/contract work. It must **not** enable heartbeat, factory, cron or autonomous execution.

Completion gate:

- authority map complete;
- kill-switch coverage proven or exact gaps documented;
- bypass tests pass for existing boundaries;
- no production autonomy enabled;
- next smallest implementation item identified from evidence.

### WE-R1.2 — Missing Circuit Breakers

Implement only the controls proven missing by WE-R1.1.

Candidate controls may include global/lane/worker/skill disable state, concurrency ceilings, bounded retries, execution budgets, rate limits and automatic pause thresholds.

No scheduler activation.

### WE-R1.3 — Runtime Observability / Control Room Contract

Establish the minimum operator visibility required before shadow scheduling: worker status, job state, authority denials, retries, verification outcomes, budgets, anomalies and emergency-stop state.

No autonomous mutation.

### WE-R1.4 — Shadow Scheduler

Allow scheduled observation/recommendation only. Production business mutations remain disabled.

Workers may detect, classify, propose and record candidate work under certified authority, but consequential actions remain blocked.

### WE-R1.5 — Shadow Certification Window

Run the shadow scheduler against real production conditions and measure:

- worker selection accuracy;
- skill/procedure selection accuracy;
- authority-denial correctness;
- duplicate job rate;
- escalation correctness;
- evidence completeness;
- retry behavior;
- cross-lane/cross-school isolation.

No transition to execution from this item alone.

### WE-R1.6 — First Reversible Low-Risk Capability

Select exactly one certified, reversible, low-risk procedure for supervised production execution.

The capability must have explicit authority, verification, rollback/compensation, rate, budget and concurrency limits.

### WE-R1.7 — Bounded Runtime Expansion

Expand only after the first capability meets its production evidence threshold.

Each additional capability remains a separate item.

### WE-R1.8 — Worker Factory Recommendation Mode

Factory may detect a workforce gap and propose a worker specification, but cannot create/activate a production worker automatically.

### WE-R1.9 — Governed Factory Probation

Only after worker execution is stable: allow factory-created workers to stop at SHADOW/probation and require independent certification before any authority is provisioned.

Broad self-expanding autonomy is not implied by this plan.

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
- runtime activation and worker-factory activation remain separate decisions.

## Next item

**WE-R1.1 — Runtime Authority & Kill-Switch Audit**

This is the only next item proposed for implementation after this documentation reconciliation is merged and verified.
