# Vibeschool Worker Engine — Canonical Authority

**Status:** Binding repository authority
**Effective:** 2026-08-11
**Operational state log:** `docs/WORKER_ENGINE_STATE_AND_GAP_LOG.md`

## One-engine rule

Vibeschool has **one Worker Engine**.

The existing HQ digital-workforce implementation (`hq_workforce_*`, its RPCs, HQ workroom/control surfaces, worker factory/lifecycle, jobs, roles, skills, decisions, evidence, verification, memory, security and audit structures) is the implementation foundation of that one engine.

The Worker Engine Architecture Freeze is **not a second engine**. It is the governance, lifecycle, security, verification and resilience specification used to harden and complete the existing HQ workforce implementation.

No parallel Worker Engine, second worker control plane, duplicate `worker_*` subsystem, or competing Foundry may be introduced.

## Canonical model

```
Existing HQ workforce implementation
              +
Worker Engine frozen governance architecture
              =
ONE VIBESCHOOL WORKER ENGINE
```

The canonical engine owns one control plane for:

1. workforce demand and gap diagnosis;
2. worker roles, blueprints and creation;
3. worker identity and lifecycle;
4. skills and capabilities;
5. authority/policy enforcement;
6. task/job routing and assignments;
7. budgets and execution limits;
8. tool/model access gateways;
9. evidence and immutable audit;
10. independent outcome verification;
11. recovery, suspension, revocation and retirement;
12. human decisions and escalation;
13. institutional memory and certified learning.

## Autonomous workforce objective

The canonical Worker Engine is intended to operate as an autonomous workforce operating system inside constitutional limits:

```text
observe company signals
-> detect work/capacity/skill/policy/tool gaps early
-> diagnose root cause
-> prefer process repair / automation / training / rebalancing
-> generate a worker only when justified
-> provision in shadow/probation
-> certify
-> activate with bounded, revocable authority and budgets
-> execute certified work through governed gateways
-> capture evidence
-> independently verify outcomes
-> recover/escalate/suspend on failure
-> learn only from verified outcomes
-> promote/rollback skills
-> rebalance/remediate/retire workers
-> repeat
```

Worker creation never creates new authority. Novel or high-risk authority remains subject to the governance/owner boundary.

## Historical branches

Historical, temporary, architecture-freeze, L0 and preservation branches are **evidence and lineage only**. Their existence does not define additional engines. They must not be treated as independent production Worker Engines.

Do not delete historical work merely to create conceptual simplicity. Preserve useful lineage while converging implementation into the canonical engine.

## Implementation rule

All future Worker Engine changes must extend or harden the canonical HQ workforce implementation. Before adding a new table, RPC, service, worker factory, queue, lifecycle controller or HQ control surface, first prove that the capability does not already exist in the canonical engine.

Where old and frozen designs overlap, consolidate rather than duplicate. Where they conflict, the stricter governance/security invariant wins unless an explicit architecture decision supersedes it.

## State-log rule

Before starting Worker Engine implementation or re-investigating the subsystem, read `docs/WORKER_ENGINE_STATE_AND_GAP_LOG.md`.

That log records audited production semantics, implemented capabilities, known gaps, safety invariants and the ordered completion sequence. Update it whenever runtime evidence materially changes the understanding of what is implemented or what remains.

The log is a handoff/control artifact; it does not override this canonical one-engine authority.

## L0 relationship

L0 database reproducibility is a prerequisite/safety gate for schema evolution, not another Worker Engine. Recovery/evidence work such as PR #68/TBL-011/TBL-012/TBL-013 supports the same canonical engine and the wider Vibeschool database.

A historical statement that L0 was red must not be reused as a current runtime conclusion without checking the latest recovery evidence. Worker Engine schema evolution remains subject to the current repository/database safety gates.

## Discovery rule for humans and AI agents

When asked how many Worker Engines Vibeschool has, the repository answer is:

> **One: the Vibeschool Worker Engine.**

The `hq_workforce_*` implementation is its existing runtime foundation. The frozen Worker Engine architecture is its binding hardening/completion specification, not a competing implementation.

Any document that describes these as two engines is historical context and is superseded by this canonical authority for current architecture decisions.

When asked what remains, do not infer completion from worker counts, `active` status, run counts, or table counts alone. Consult the operational state/gap log and verify runtime semantics.

## Promotion boundary

This authority document and its state/gap log can evolve independently of new Worker Engine DDL because documentation can record architecture identity and verified runtime findings without changing production behavior. Actual schema/security/runtime implementation remains subject to the protected-workflow, TypeScript/build, migration, security and production verification gates.
