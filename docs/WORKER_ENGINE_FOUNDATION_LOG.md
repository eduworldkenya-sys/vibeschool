# Vibeschool Worker Engine — Foundation Recovery Log

**Status:** Foundation recovered and reconciled; controlled coding may begin  
**Updated:** 2026-08-12  
**Authority:** Subordinate to `WORKER_ENGINE_CANONICAL.md` and the frozen Worker Engine architecture.

## Founding vision

Vibeschool is building one governed autonomous workforce operating system, not a collection of unrestricted AI agents.

The intended end state is an engine capable of observing the company, detecting workforce demand or operational gaps early, validating evidence, diagnosing the appropriate response, locating/reusing/rebalancing existing workers first, generating a new worker only when justified, provisioning it, shadowing it, verifying it, routing certification, activating it under bounded authority, assigning work, supervising outcomes, learning from verified evidence, remediating/suspending/recertifying workers and ultimately retiring/archive them with complete institutional evidence.

## 95/5 doctrine

Approximately 95% of execution capability is deterministic computing. AI is a bounded approximately 5% interpretive capability.

Deterministic computing owns lifecycle, contracts/schema validation, authorization, scope, capabilities, budgets, routing, identity validation, policy evaluation, verification, idempotency, audit, retries, failure handling, suspension/revocation and authoritative state mutation.

AI is restricted to explicitly classified semantic work such as extraction, classification, interpretation, summarization, explanation and bounded recommendation. AI output is untrusted until deterministic verification. AI cannot create authority, change policy, bypass verification, access credentials, call unrestricted tools directly or directly mutate authoritative state.

## Canonical autonomous loop

```text
Observe / Telemetry
-> Detect demand or gap
-> Validate evidence
-> Diagnose response
-> Eliminate / redesign / automate / train / rebalance / temporary capacity / human judgment / new digital worker
-> Plan bounded response
-> Authorize
-> WorkerCreationContract when creation is justified
-> Instantiate
-> Bind identity
-> Provision scope/capabilities/budget/queue
-> SHADOW
-> Verify
-> CERTIFICATION_PENDING
-> Governance certification
-> CERTIFIED
-> ACTIVE
-> Assign -> execute -> verify
-> Monitor
-> Learn / remediate / suspend / recertify / retire
-> Immutable institutional evidence
-> Repeat
```

Demand detection cannot create authority. The creator cannot certify itself. Certification does not grant authority beyond the approved blueprint. Audit evidence cannot be rewritten by the subject being audited.

## Canonical lifecycle

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

Illegal transitions fail closed. Certification expiry blocks new assignment. Suspension blocks new assignment and invokes credential enforcement. Retirement is terminal unless explicitly superseded by a future architecture version.

## Canonical contract set

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

Contracts are versioned and immutable once issued. Unknown versions fail closed. Security-relevant contracts carry explicit semantic scope. Externally visible effects require idempotency.

## Reconciliation completed 2026-08-12

A production catalog/runtime inspection was reconciled against the recovered architecture. The detailed KEEP/HARDEN/MIGRATE/BUILD decisions are in `WORKER_ENGINE_RECONCILIATION_MATRIX.md`; status tracking is in `WORKER_ENGINE_PROGRESS_LOG.md`.

### Strong existing foundations to preserve

- 32 `hq_workforce_*` tables forming the existing one-engine control plane.
- 10 workers, 10 lanes and 12 versioned skills.
- deterministic gap diagnosis and quantified Workforce Intelligence decision tree.
- worker probation creation mechanics.
- context authorization primitives.
- decisions and owner escalation.
- independent outcome verification.
- recovery structures.
- evidence, corrections, learning candidates, skill promotion/replay/rollback and institutional memory.
- fail-closed direct workforce-table access: inspected workforce tables have RLS enabled with no direct policies.
- only two workforce RPCs exposed to `authenticated`; both are HQ-owner asserted.
- all 10 currently active workers have paid AI disabled.

### Important corrections established

1. Current worker `active` status is historical runtime status, not proof of certification under the frozen canonical lifecycle.
2. `hq_workforce_execute_safe_queue()` currently performs `internal_review_only` with `side_effects=none`; it is orchestration/review, not the final real execution kernel.
3. There are no production workforce cron jobs; schedule metadata does not yet constitute an autonomous heartbeat.
4. The runtime has 5 jobs for 10 workers; 5 workers currently lack `job_key` normalization.
5. There are 0 `school_id` columns across 32 workforce tables. Scope must be classified contract-by-contract as platform-global or school-scoped; blindly adding `school_id` is prohibited.
6. Existing descriptive `permissions` are not equivalent to canonical enforceable capability grants.
7. Existing `paid_ai_allowed` is not equivalent to the complete 95/5 Model Gateway contract.
8. Existing worker UUID/key is not equivalent to canonical WorkerIdentity + expiring/revocable credential binding.

## Foundation gate decision

**GREEN FOR CONTROLLED IMPLEMENTATION CODING.**

The architecture-discovery/reconciliation phase is closed. Further open-ended design archaeology is not required before WE-L1.

This does not authorize broad autonomy or production mutation. It authorizes implementation on a protected branch against the reconciled architecture.

## Next phase: WE-L1 — Authority & Lifecycle Convergence

Implement in this order:

1. canonical contract registry primitives;
2. Blueprint + WorkerCreationContract authority ceiling;
3. canonical lifecycle registry and single-writer transition RPC;
4. transitional mapping for legacy active workers without falsely recertifying them;
5. WorkerIdentity + live revocation primitive;
6. enforceable capability grants;
7. transactional worker execution budgets;
8. negative acceptance tests for illegal lifecycle transitions, missing authority, revoked identity, missing capability and exhausted budget.

Do not enable production-effect Tool Gateway execution, Model Gateway AI, scheduler-driven autonomous creation or broad worker expansion until these gates pass.

## Implementation discipline

No new table/RPC/service is justified merely because the architecture names a concept. First prove the existing `hq_workforce_*` implementation cannot safely be extended. Preserve conforming behavior, harden partial behavior and migrate historical representations instead of duplicating them.

Implementation must not silently invent architecture. If coding exposes a genuinely missing architectural decision, update the architecture/log explicitly before implementing it.

## Log discipline

Every material Worker Engine change must update the progress ledger with evidence, implementation state, acceptance result and next safe action. Never mark a capability complete from documentation or row counts alone.