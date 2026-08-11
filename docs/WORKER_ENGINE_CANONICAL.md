# Vibeschool Worker Engine — Canonical Authority

**Status:** Binding repository authority
**Effective:** 2026-08-11

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

## Historical branches

Historical, temporary, architecture-freeze, L0 and preservation branches are **evidence and lineage only**. Their existence does not define additional engines. They must not be treated as independent production Worker Engines.

Do not delete historical work merely to create conceptual simplicity. Preserve useful lineage while converging implementation into the canonical engine.

## Implementation rule

All future Worker Engine changes must extend or harden the canonical HQ workforce implementation. Before adding a new table, RPC, service, worker factory, queue, lifecycle controller or HQ control surface, first prove that the capability does not already exist in the canonical engine.

Where old and frozen designs overlap, consolidate rather than duplicate. Where they conflict, the stricter governance/security invariant wins unless an explicit architecture decision supersedes it.

## L0 relationship

L0 database reproducibility is a prerequisite/safety gate for further schema evolution. L0 is **not another Worker Engine**. PR #68 and TBL-012 are recovery/evidence work supporting the same canonical engine and the wider Vibeschool database.

## Discovery rule for humans and AI agents

When asked how many Worker Engines Vibeschool has, the repository answer is:

> **One: the Vibeschool Worker Engine.**

The `hq_workforce_*` implementation is its existing runtime foundation. The frozen Worker Engine architecture is its binding hardening/completion specification, not a competing implementation.

Any document that describes these as two engines is historical context and is superseded by this canonical authority for current architecture decisions.

## Promotion boundary

This authority document can be promoted independently of new Worker Engine DDL because it resolves architecture identity without changing production behavior. Actual schema/security implementation remains subject to L0, protected-workflow, TypeScript/build, migration and security verification gates.
