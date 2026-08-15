# WE-R1.4 — Controlled Autonomous Operations

Status: ENGINEERING / NON-ACTIVATING

## Mission

Prove that one explicitly certified capability can perform one bounded, reversible, measurable production mutation through the canonical Worker Engine while all unrelated capabilities remain non-autonomous.

Canonical execution chain:

`Objective → Plan → Plan Step → Certified Capability Version → Authority Envelope → Preconditions → Idempotency → Consequential Gateway → Postcondition Verification → Measure → Compensate/Escalate`

R1.4 authorizes capabilities, never workers wholesale.

## Entry criteria

R1.4 engineering may proceed while runtime remains OFF. Production canary activation is prohibited unless all of the following are independently evidenced on the exact production baseline:

1. WE-R1.3X repository certification is complete on the promoted head.
2. Production migrations required by WE-R1.3X are reconciled.
3. A real production Global Shadow Trial has completed with immutable evidence and no consequential side effects.
4. Worker Engine fail-closed posture is verified immediately before activation.
5. No unresolved security or migration advisor finding affects the R1.4 execution path.

Failure of an entry criterion blocks activation, not engineering.

## Constitutional invariants

- No authority grant → no execution.
- No certified capability version → no execution.
- No valid selected plan and plan step → no execution.
- No exact scope match → no execution.
- No valid preconditions → no execution.
- No idempotency key where required → no execution.
- No bounded compensation strategy where required → no execution.
- Verification failure → PAUSE / COMPENSATE / ESCALATE.
- Global stop dominates every capability grant.
- Capability stop dominates worker assignment.
- Worker identity, lifecycle and competency remain necessary but never sufficient for autonomous authority.
- The engine cannot create, expand, certify, activate or rewrite its own authority.
- Factory, heartbeat and unrelated consequential capabilities remain OFF unless separately certified in a later mission.

## First production canary

Capability: `internal.work_queue.prioritize@1`

Purpose: detect stale internal Worker Engine operational work, classify priority, update priority on only the canonical internal Worker Engine queue, and verify the mutation.

Excluded blast radius:

- learners and student records;
- teachers and school operational records;
- curriculum/publication state;
- communications and notifications;
- payments, wallets, subscriptions and M-Pesa;
- authentication, authorization and security administration;
- external integrations;
- worker creation or Factory activation.

The canary must be reversible by restoring the exact pre-execution priority snapshot.

## Gate sequence

### R1.4.1 — Capability-scoped authority grants

Introduce an immutable, versioned authority envelope for a single capability version. Authorization is the intersection of capability authority, existing worker capability grant, worker identity/lifecycle/certification, certified skill manifest, plan-step requirements, runtime policy and global stop state. No activation occurs in this gate.

### R1.4.2 — Consequential Execution Gateway

Build one gateway as the only path from an approved plan step to a consequential mutation. Direct capability handlers remain unreachable to product roles. The gateway must emit append-only authorization/execution evidence for allow and deny outcomes.

### R1.4.3 — Preconditions + idempotency

Bind every execution to typed preconditions, a stable idempotency key, expected source version/state, and replay semantics. Duplicate execution must become a no-op with evidence rather than a second mutation.

### R1.4.4 — Postcondition verification

A mutation is not successful until an independent verifier confirms the exact expected state and affected-record ceiling.

### R1.4.5 — Compensation / rollback

Persist the pre-execution snapshot needed for bounded compensation. Compensation is a separate governed transition and must itself be verified.

### R1.4.6 — Budgets / rate / concurrency

Enforce capability-specific operations-per-cycle, records-per-operation, rate, concurrency and runtime ceilings in addition to existing worker budgets.

### R1.4.7 — Circuit breakers and stops

Support global, capability and assigned-worker stops. Verification failures, repeated denials, scope anomalies, compensation failures and budget violations trip the relevant breaker fail-closed.

### R1.4.8 — Canary certification

Certify only `internal.work_queue.prioritize@1` against the exact tool/skill/plan/verification/compensation contracts. Certification does not activate it.

### R1.4.9 — Adversarial autonomous execution tests

Test missing grants, expired grants, wrong capability version, wrong worker, wrong plan step, stale preconditions, replay, duplicate delivery, over-budget execution, concurrency collision, scope expansion, verifier failure, compensation failure, stop races and privilege bypass.

### R1.4.10 — Production canary

Activation requires a separate explicit production gate. Begin with one operation, one record, one capability, one worker assignment and global stop inheritance. Expand only within the already-certified envelope.

### R1.4.11 — Extended observation

Measure execution count, denial rate, verification success, compensation count, breaker trips, latency, stale-precondition rate and human intervention. Any unexplained mismatch resets the capability to OFF.

### R1.4.12 — Autonomous Operations Certification

Certify R1.4 only if the exact production evidence proves bounded mutation, independent verification, recoverability and zero authority leakage.

## Engineering loop per gate

Each gate uses the same loop:

`Inspect real GitHub + production schema → compare canonical vs legacy → design additive contract → implement on isolated branch → static security review → disposable/clean DB rebuild → database adversarial tests → TypeScript → ESLint → production build → exact-head CI → production-read-only reconciliation → advance`

A gate is not complete because code exists. It is complete only when its own acceptance evidence is green on the same commit.

## Required checks

Every R1.4 migration must pass the repository migration-security contract and explicitly declare table/function access. Exposed tables use RLS and explicit grants. Security-definer functions must use a pinned/empty search path, narrow execute grants, and no caller-controlled authorization metadata. No `anon` or ordinary `authenticated` role receives Worker Engine control-plane access.

Every mutation path must prove: exact target table, exact columns allowed to change, maximum rows, expected prior state, idempotency, verification, compensation, evidence append, and stop inheritance.

Every TypeScript boundary must use generated database types or explicit validated domain types; no `any`-based authority payloads, no unchecked JSON authority decisions, and no client-side trust for privileged state.

## Current production prerequisite finding — 2026-08-15

Repository R1.3X closure and production reconciliation PRs are merged, and the live engine contract remains fail-closed: heartbeat OFF, Factory OFF, consequential runtime OFF, autonomy L0/R0, Shadow OFF and Shadow global stop ON. However, the live `hq_workforce_shadow_runs` relation currently contains no production trial rows. Therefore the real Global Shadow Trial entry criterion is not yet evidenced and R1.4 production activation remains blocked while engineering proceeds.
