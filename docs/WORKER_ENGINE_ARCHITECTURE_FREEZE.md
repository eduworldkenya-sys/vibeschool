# VibeSchool Worker Engine — Architecture Freeze v1

**Status:** Binding architecture baseline for implementation
**Mode:** Production refinement
**AI budget:** Approximately 5% of execution capability; deterministic computing owns the remaining execution path.
**Effective rule:** Architecture decisions are made here before implementation. Code must not silently create new architecture.

## 1. Purpose

The Worker Engine is a **deterministic workforce orchestration and governance execution system**. It manages bounded virtual workers through governed creation, identity, provisioning, work routing, execution, verification, supervision, suspension, recertification, and retirement.

The engine executes delegated authority. It does not originate authority.

## 2. Hard Boundaries — What the Engine Is NOT

The Worker Engine is not:

1. A policy authority. Governance owns policy.
2. A certification authority. Governance owns certification decisions.
3. An unrestricted autonomous agent.
4. An LLM-driven control loop.
5. An authority-expansion mechanism.
6. An audit authority. The engine emits evidence; the audit ledger preserves it.
7. A credential store or global secret holder.
8. A cross-school data broker unless an explicit governed cross-school contract exists.

### Five constitutional NOs

- **NO self-governance:** the engine cannot alter its own governing policy, authority ceilings, audit rules, or approval requirements.
- **NO unrestricted authority grant:** no worker can grant itself, another worker, or the engine additional capability, scope, budget, or certification.
- **NO audit bypass:** privileged actions must produce immutable audit evidence.
- **NO policy override:** policy denial cannot be bypassed by prompts, application flags, or AI output.
- **NO unbounded worker creation:** creation requires approved blueprint, evidence, scope, budget, risk gates, and the applicable approval class.

## 3. Authority Ownership

| Responsibility | Owner | Worker Engine role |
|---|---|---|
| Constitution | Owner/Governance | Enforce |
| Policy authoring/versioning | Governance / Policy Store | Evaluate |
| Certification decision | Governance | Consume certification |
| Authority ceiling | Governance + approved Blueprint | Enforce |
| Worker creation | Creation Controller / Foundry | Execute approved creation |
| Identity issuance | Identity Binding | Execute bounded issuance mechanics |
| Capability execution | Tool Gateway | Enforce |
| AI access | Model Gateway | Enforce |
| Verification | Verification Engine | Gate state-changing outcomes |
| Audit preservation | Audit/Event Ledger | Emit immutable events |
| Human exception decisions | Governance / Escalation | Route and execute |

**Separation of duties:** the component that detects demand cannot create a worker; the creator cannot certify it; the certifier cannot execute its work; and the auditor cannot modify the record it audits.

## 4. Core Invariants

1. **Deny by default.** Absence of an authorization artifact means denial.
2. **Authority travels as explicit artifacts.** No privilege is inferred from names, prompts, reputation, or application convention.
3. **Blueprint ceiling is absolute.** A worker's authority can never exceed its approved blueprint ceiling.
4. **Lifecycle state has one writer.** State changes occur only through the lifecycle transition mechanism.
5. **Privileged effects are transactional.** Authorization, economic consumption, state mutation, and required evidence must not silently desynchronize.
6. **AI output is untrusted input.** AI output cannot become authoritative without deterministic verification.
7. **School scope is mandatory.** Every worker, task, contract, context envelope, capability, and privileged data path is school-scoped unless an explicit cross-school contract exists.
8. **Credentials expire and are revocable.** Expiry is the backstop; live revocation is checked at privileged boundaries.
9. **Audit is append-only.** Historical evidence is never rewritten to make a later state look correct.
10. **The engine cannot expand its own authority.** Configuration and governing artifacts are externally governed and versioned.

## 5. 95/5 Execution Doctrine

The Worker Engine is not an AI agent with deterministic helpers. It is a deterministic computing system with bounded AI capabilities.

### Deterministic 95%

The following remain deterministic wherever technically possible:

- lifecycle state transitions
- contracts and schema validation
- authorization and scope checks
- capability checks
- budgets and quotas
- queueing and routing
- identity validation
- policy evaluation
- verification gates
- idempotency
- audit emission
- retries and failure handling
- suspension and revocation enforcement
- persistence and ledger mutation

### AI ~5%

AI is limited to explicitly classified skills such as:

- semantic classification
- extraction
- interpretation
- summarization
- explanation
- recommendation where permitted

AI cannot create authority, change policy, bypass verification, call tools directly, access credentials, or mutate authoritative state.

**AI-0 skills cannot call the Model Gateway.** Interpretive work must be declared as an AI-enabled skill with its own contract and verification path.

## 6. Canonical Lifecycle

```text
PROPOSED
  → REQUESTED
  → INSTANTIATED
  → PROVISIONED
  → SHADOW
  → CERTIFICATION_PENDING
  → CERTIFIED
  → ACTIVE
  → SUSPENDED
  → REMEDIATION
  → CERTIFICATION_PENDING
  → CERTIFIED
  → ACTIVE
  → RETIRED
  → ARCHIVED
```

Additional terminal/early-exit paths may include governed retirement from SHADOW or CERTIFICATION_PENDING.

### Lifecycle rules

- Illegal transitions are rejected, not normalized.
- State is not directly writable by ordinary application roles.
- Each transition has a named gate and required evidence.
- Certification expiry blocks new task assignment.
- Suspension blocks new assignment and triggers credential enforcement.
- Retirement is terminal; reactivation is not an implicit transition.

## 7. Canonical Contract Set

The minimum contract registry is:

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

### Contract rules

- Contracts are immutable once issued.
- Every contract has an explicit `schema_version`.
- Consumers reject unknown versions rather than guessing.
- New shapes are published as new versions; old versions are drained before deprecation.
- Every security-relevant contract carries `school_id`.
- Cross-school work requires an explicit contract class and Governance authorization.
- Every task capable of causing an externally visible effect has an idempotency key.

## 8. Enforcement Map

| Rule | Primary enforcement | Backstop |
|---|---|---|
| Blueprint approved | Registry + Policy Gate | DB foreign key/state constraint |
| Worker authority ≤ blueprint ceiling | Privileged DB function/constraint | Verification |
| Legal lifecycle transition | Transition table + single-writer RPC | Audit/alerts |
| Capability granted | Capability record + Tool Gateway | DB/RLS |
| Budget available | Transactional DB function + row lock | Audit |
| School scope | Boundary RPC + RLS | Contract validation |
| AI class permitted | Model Gateway | Verification |
| AI output trusted | Verification Engine | Immutable audit |
| Worker revoked | Live revocation check on privileged calls | Credential expiry |
| Shadow cannot mutate production | Sandbox schema/role separation | RLS |
| Audit cannot be rewritten | DB privilege model | Hash-chain verification |
| Unknown contract version | Contract registry | DLQ + audit |

No rule is considered implemented merely because application code checks it.

## 9. Platform Constraints

### Supabase/Postgres

Postgres is the system-of-record enforcement layer for worker lifecycle, authority ceilings, budgets, capabilities, contracts, and audit primitives.

Privileged state mutation uses tightly scoped `SECURITY DEFINER` functions with explicit `search_path`. Direct table updates by ordinary roles are revoked.

### Identity and RLS

The engine does **not** assume a custom worker JWT automatically becomes a Supabase/PostgREST `request.jwt.claims` context.

The default architecture is boundary-RPC enforcement: the worker credential is verified for signature, expiry, revocation, school scope, worker identity, blueprint version, lane, and capability; transaction-local claims are then made available to RLS where needed.

A project-secret-signed JWT integration is an explicit alternative architecture decision, not an implicit assumption.

### Queue execution

Vercel functions are ephemeral. The design must not assume a persistent worker listener.

Queue consumption therefore operates through explicit polling/trigger execution and/or a measured persistent consumer outside Vercel if latency requirements justify it. Queue SLAs must account for polling interval, batch size, retries, visibility, and backpressure.

### Audit concurrency

Hash-chain appends must be serialized. The implementation must use transaction-scoped locking and avoid a single unbounded global lock where partitioned chains are appropriate.

The production target is partitioned audit chains with independently verifiable anchors.

## 10. Existing HQ Workforce Code — Interpretation

The repository already contains an HQ Digital Workforce implementation, including `hq_worker_templates`, `hq_workers`, `hq_worker_messages`, `hq_worker_runs`, KPIs, certifications, activation approvals, and lifecycle/security functions.

Those artifacts are **implementation history and foundation material**, not permission to bypass this architecture freeze. Existing behaviour must be reconciled against these invariants before it is promoted as canonical Worker Engine behaviour.

In particular, the current `paid_ai_allowed` flag is not sufficient to represent the full 95/5 AI governance model, and existing worker statuses do not by themselves constitute the canonical lifecycle above.

The existing deterministic work bus is valuable and should be preserved where it conforms to the contracts and enforcement map.

## 11. Acceptance Gate Before Worker Engine Expansion

The following must be demonstrably true before higher-level Worker Engine implementation expands:

- Unapproved blueprint creation is rejected.
- Authority cannot exceed blueprint ceiling.
- Illegal lifecycle transitions are rejected.
- Missing school scope is rejected.
- Cross-school work is rejected without an explicit governed contract.
- Capability absence blocks tool execution.
- Budget breach aborts the privileged transaction.
- AI output that fails verification produces zero authoritative mutation.
- AI-0 cannot reach the Model Gateway.
- Revocation blocks the next privileged call.
- Shadow execution cannot write production data.
- Duplicate task idempotency keys cannot duplicate effects.
- Audit writes remain verifiable under concurrent writers.
- Unknown contract versions are rejected/DLQ'd.
- Model Gateway outage does not break deterministic AI-0 work.
- Complete worker history is reconstructible from immutable events.

## 12. Coding Rule

**No implementation code may introduce an architectural decision.**

If implementation exposes a missing decision, coding stops. The decision is recorded here, reviewed, and only then implemented.

Every implementation change must identify:

- the architecture section it implements;
- the contract(s) it consumes or produces;
- the enforcement mechanism;
- the acceptance test(s) it satisfies;
- the authority boundary it crosses, if any.

## 13. Implementation Order

```text
Architecture Freeze
→ Foundation reconciliation
→ RPC/security hardening verification
→ Contract registry
→ Database primitives
→ Audit ledger
→ Lifecycle state machine
→ Blueprint + Worker records
→ Identity + capabilities + budgets
→ Queue + task routing
→ Context + tools
→ Verification
→ Model Gateway
→ Reference Worker
→ Controlled autonomy
```

**No general autonomous workforce is built before one reference worker passes the complete lifecycle and security acceptance suite.**

## 14. Freeze Decision

This document is the implementation boundary for the Worker Engine v1.

The design is intentionally conservative: deterministic mechanisms own authority and state; AI supplies bounded interpretation only. The architecture may be amended when evidence requires it, but amendments must be explicit and versioned rather than emerging accidentally from implementation.
