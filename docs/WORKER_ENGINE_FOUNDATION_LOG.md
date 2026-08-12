# Vibeschool Worker Engine — Foundation Recovery Log

**Status:** Active implementation/recovery log  
**Updated:** 2026-08-12  
**Authority:** Subordinate to `WORKER_ENGINE_CANONICAL.md` and the frozen Worker Engine architecture.

## Purpose

This log records what the Worker Engine was originally intended to become, what already exists, what has been recovered from historical architecture work, and what remains before controlled autonomy can be considered complete.

It prevents future implementation work from losing the original foundation or mistaking historical implementations for separate engines.

## Recovered founding vision

Vibeschool is building one governed autonomous workforce operating system, not a collection of unrestricted AI agents.

The intended end state is an engine capable of observing work, detecting workforce demand or operational gaps, validating evidence, diagnosing the appropriate response, locating an existing capable worker where possible, assigning or rebalancing work, creating a new worker only when justified, provisioning that worker, running it in shadow, verifying its results, routing certification, activating it, supervising it, remediating or suspending it when necessary, and ultimately retiring/archive it with complete institutional evidence.

### 95/5 doctrine

Approximately 95% of execution capability is deterministic computing. AI is a bounded approximately 5% interpretive capability.

Deterministic ownership includes lifecycle transitions, contracts/schema validation, authorization, school scope, capability checks, budgets/quotas, queueing/routing, identity validation, policy evaluation, verification gates, idempotency, audit emission, retries/failure handling, suspension/revocation, persistence and authoritative state mutation.

AI is reserved for explicitly classified semantic work such as extraction, classification, interpretation, summarization, explanation and bounded recommendation. AI output is untrusted input until deterministic verification passes. AI cannot create authority, change policy, bypass verification, access credentials, directly call unrestricted tools, or directly mutate authoritative state.

## Canonical autonomous loop

```text
Observe / Telemetry
  -> Detect demand or gap
  -> Validate evidence
  -> Diagnose response
  -> Locate/reuse/rebalance existing capability first
  -> Plan bounded workforce response
  -> Authorize
  -> Issue WorkerCreationContract when creation is justified
  -> Instantiate
  -> Bind identity
  -> Provision scope/capabilities/queue/budget
  -> SHADOW
  -> Verify
  -> CERTIFICATION_PENDING
  -> Governance certification
  -> CERTIFIED
  -> ACTIVE
  -> Assign/execute/verify
  -> Monitor
  -> Learn / remediate / suspend / recertify / retire
  -> Preserve immutable institutional evidence
```

Demand detection does not grant creation authority. Creation does not grant certification authority. Certification does not grant execution authority outside the certified blueprint. Audit evidence cannot be rewritten by the component being audited.

## Canonical lifecycle recovered from the architecture freeze

```text
PROPOSED
  -> REQUESTED
  -> INSTANTIATED
  -> PROVISIONED
  -> SHADOW
  -> CERTIFICATION_PENDING
  -> CERTIFIED
  -> ACTIVE
  -> SUSPENDED
  -> REMEDIATION
  -> CERTIFICATION_PENDING
  -> CERTIFIED
  -> ACTIVE
  -> RETIRED
  -> ARCHIVED
```

Illegal transitions fail closed. Certification expiry blocks new assignments. Suspension blocks new assignments and invokes credential enforcement. Retirement is terminal unless a future explicit architecture amendment defines otherwise.

## Canonical contract set

The recovered minimum registry is:

- `DemandEvidence`
- `WorkerCreationContract`
- `WorkerRecord`
- `WorkerIdentity`
- `Blueprint`
- `SkillContract`
- `TaskContract`
- `ContextEnvelope`
- `ToolContract`
- `AIInvocation`
- `VerificationResult`
- `CertificationRecord`
- `SuspensionRecord`
- `RetirementRecord`
- `AuditEvent`

Contracts are versioned and immutable once issued. Unknown versions fail closed rather than being guessed. Security-relevant contracts carry explicit scope. Externally visible effects require idempotency.

## Recovered enforcement doctrine

A rule is not considered implemented merely because frontend or ordinary application code checks it. Security and authority invariants require mechanical enforcement at the appropriate database, RPC, gateway, policy, queue, verification or immutable-audit boundary.

Required properties include deny-by-default authority, blueprint ceilings, single-writer lifecycle transitions, capability-gated tools, transactional budgets, school-scope enforcement, model-gateway AI classification, deterministic verification of AI output, live revocation checks, production isolation during shadow execution, append-only audit evidence, idempotency and fail-closed contract-version handling.

## Existing implementation foundation

The existing `hq_workforce_*` database/runtime, HQ workforce surfaces, worker templates, workers, roles, jobs, assignments, messages/runs, skills, decisions, evidence, verification, memory, certifications, activation approvals and related lifecycle/security functions are foundation material for this same Worker Engine.

They are not a second engine. Existing useful deterministic work-bus behavior should be preserved where it conforms to the canonical architecture.

## Current reconciliation findings

### Confirmed

- One-engine authority is now recorded on `main` in `docs/WORKER_ENGINE_CANONICAL.md`.
- Historical HQ workforce code and frozen architecture are explicitly defined as one engine lineage.
- The architecture freeze contains the detailed 95/5 doctrine, constitutional boundaries, lifecycle, contract registry, enforcement map, platform constraints and reference lifecycle trace.
- The architecture explicitly prohibits general autonomous-workforce expansion before one reference worker passes the complete lifecycle/security acceptance suite.

### Partial / requires reconciliation

- Existing worker statuses and lifecycle behavior predate the canonical lifecycle and must be mapped rather than assumed equivalent.
- Existing `paid_ai_allowed`-style controls do not by themselves implement the full AI classification/model-gateway doctrine.
- Existing workforce tables/RPCs need contract-by-contract comparison with the recovered canonical registry.
- Existing audit/evidence structures need verification against append-only/concurrency/reconstructability requirements.
- Existing worker creation/factory behavior needs proof that detection, authorization, creation, certification and execution powers remain separated.

### Not yet proven complete

- Full autonomous demand -> diagnosis -> reuse/rebalance/create decision loop.
- Deterministic proof that an existing worker is preferred before creating another worker.
- Complete canonical lifecycle enforcement through one writer.
- Complete immutable/versioned contract registry.
- Blueprint authority ceilings enforced at privileged boundaries.
- Worker identity issuance, expiry and live revocation at every privileged call.
- Capability and budget enforcement transactionally bound to privileged effects.
- Production-isolated SHADOW execution.
- Independent deterministic outcome verification before authoritative mutation where required.
- Full Model Gateway with AI-0 denial and bounded AI-enabled skills.
- Complete queue retry/backpressure/DLQ/idempotency semantics.
- Complete institutional event history sufficient to reconstruct a worker from proposal through archive.
- One reference worker passing the entire lifecycle and security acceptance suite.
- Controlled autonomous worker generation enabled only after that reference-worker gate passes.

## Implementation gate

Do not add another Worker Engine, parallel Foundry, duplicate lifecycle controller or competing `worker_*` control plane.

Before implementing a missing capability:

1. inspect the existing HQ workforce implementation;
2. identify whether the capability already exists fully or partially;
3. map it to the canonical architecture section and contract;
4. preserve conforming behavior;
5. harden/reconcile conflicting behavior rather than duplicating it;
6. define the mechanical enforcement boundary;
7. define the acceptance test;
8. implement only after the architecture decision is explicit.

## Current recommended sequence

```text
Foundation documentation recovery
-> Existing HQ workforce inventory
-> Architecture-to-runtime reconciliation matrix
-> Security/RPC enforcement verification
-> Canonical contract registry
-> Lifecycle state-machine reconciliation
-> Identity/capabilities/budgets
-> Audit/event reconstruction guarantees
-> Queue/task routing and idempotency
-> Context/tool gateways
-> Verification engine
-> Model Gateway
-> One reference worker end-to-end
-> Full acceptance/security suite
-> Controlled autonomy
-> Demand-driven worker generation
```

## Architecture-change rule

Implementation must not silently invent architecture. If coding exposes a missing architectural decision, record and review that decision first. Amendments must be explicit and versioned.

## Log discipline

Update this file whenever a material Worker Engine capability changes state. Each future update should record evidence, current implementation status, remaining gap, acceptance test and the next smallest safe action. Never mark a capability complete from documentation alone; completion requires runtime/mechanical evidence.