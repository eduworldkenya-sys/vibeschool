# Worker Engine Architecture Freeze v1

**Status:** FROZEN / IMPLEMENTATION BLOCKED AT L0  
**Date:** 2026-08-10  
**Scope:** Governance workforce orchestration and enforcement layer  
**Authority:** Architecture decision record; implementation must not invent policy

## 1. Purpose

The Worker Engine is a deterministic workforce orchestration and governance execution system. It executes delegated authority; it originates none.

This document records the architecture freeze that governs implementation. It is intentionally separate from migration SQL and does not authorize production schema changes.

## 2. Absolute constraints

1. **No AI-originated authority.** Model output cannot grant, expand, or extend authority.
2. **No action without same-transaction audit.** Every privileged action must have an auditable event in the same transaction.
3. **No direct egress.** Workers and skills reach external systems only through the Tool Gateway and Model Gateway.
4. **No implicit trust.** Names, origins, titles, or claims do not confer authority; every call is verified.
5. **No architecture in code.** If implementation reveals a missing decision, implementation stops and the architecture is amended first.

## 3. Authority model

Authority originates with the Owner through the Constitution. Governance codifies it through signed, versioned, expiring artifacts. Identity Binding delegates it through short-lived, scoped credentials and capability rows.

Authority is checked at three floors:

- application Policy Gate;
- boundary RPCs with explicit transaction context;
- PostgreSQL grants and RLS.

All floors deny by default. Revocation is live: privileged calls check `worker_revocations` on every call, with credential expiry as a backstop. The audit ledger proves the resulting action history.

## 4. Canonical lifecycle

The Worker Engine has one lifecycle writer and the following permitted transitions only:

| From | To | Gate |
|---|---|---|
| PROPOSED | REQUESTED | Evidence completeness |
| REQUESTED | INSTANTIATED | Contract validation + budget reservation |
| INSTANTIATED | PROVISIONED | Identity reserved, credential issued, provisioning applied |
| PROVISIONED | SHADOW | Sandbox attestation |
| SHADOW | CERTIFICATION_PENDING | Shadow KPIs: 100% deterministic accuracy |
| SHADOW | RETIRED | Failure beyond remediation policy |
| CERTIFICATION_PENDING | CERTIFIED | Governance signature only |
| CERTIFIED | ACTIVE | Activation checklist |
| ACTIVE | SUSPENDED | Signed suspension authorization |
| SUSPENDED | REMEDIATION | Approved remediation plan |
| REMEDIATION | CERTIFICATION_PENDING | Retest evidence |
| CERTIFIED | RETIRED | Expiry or signed retirement order |
| ACTIVE | RETIRED | Expiry or signed retirement order |
| RETIRED | ARCHIVED | Archive integrity verified |

Illegal transitions must be rejected and alarmed. Remediation is bounded; exceeding the approved remediation cycle count retires the worker.

## 5. Canonical contract fields

Every security-relevant contract carries `school_id`. Missing or mismatched school scope is a hard rejection.

- **WorkerRecord:** worker_id, school_id, blueprint_id/version, state, identity_ref, lane, ttl
- **Blueprint:** id, version, mandate, skills, limits, AI classes, signatures
- **WorkerIdentity:** worker_id, credential, scopes, school_id, issued_at, exp, attester
- **Certification:** cert_id, worker_id, blueprint_version, skill_versions, evidence_refs, expires_at, signer
- **Task:** task_id, idempotency_key, school_id, type, skill_versions, context_ref, limits, verification_plan
- **Capability:** worker_id, school_id, tool/skill, scope, granted_by, exp
- **Budget:** worker_id, school_id, compute_cap, exposure_cap, spent, lock_owner
- **Context:** envelope_id, school_id, sources, payload_refs, ttl, canonical_hash
- **Tool:** tool_id, worker_id, school_id, allowed_ops, pre/post gates
- **AI Call:** skill_id, ai_class, token_budget, prompt_hash, response_hash, provider
- **Verification:** verification_id, task_ref, gates, overall, deterministic_signature
- **Audit Event:** event_id, chain_id, seq, prev_hash, actor, school_id, payload, hash, ts

Unknown contract versions are rejected and routed to DLQ.

## 6. Enforcement map

| Invariant | Enforcement | Acceptance test |
|---|---|---|
| Blueprint authority cannot be exceeded | Capability rows + boundary RPC join | AT-11 |
| Illegal lifecycle transition | DB transition table + lifecycle RPC | AT-09 |
| Missing capability | Tool Gateway capability check | AT-05 |
| Budget cannot be exceeded | Transactional row-locked budget function | AT-12 |
| AI class cannot exceed authorization | Model Gateway class enforcement | AT-18 |
| AI output cannot become trusted directly | Verification gates | AT-06 |
| Cross-school access denied | RLS + boundary RPC | AT-23 |
| Audit history cannot be modified | Grants/role restrictions + hash chain | AT-10, AT-21 |
| Revoked worker cannot continue privileged work | Live revocation check | AT-22 |
| Shadow cannot write production | Sandbox grants + RLS backstop | AT-03 |
| Unapproved blueprint cannot instantiate | Registry gate | AT-01 |
| Unknown contract version cannot execute | DLQ rejection | AT-24 |
| Provider outage cannot fail open | Per-provider breaker | AT-25 |

## 7. Implementation order

The implementation is deliberately dependency-ordered:

- **L0:** Foundation verification, migration reconciliation, TBL-011, RPC hardening.
- **L1:** Database primitives: roles, grants, revocation, transition table.
- **L2:** Security boundary RPCs and RLS floors.
- **L3:** Audit ledger and serialized hash-chain append.
- **L4:** Lifecycle state machine.
- **L5:** Blueprint registry, Worker Foundry, identity reservation/issuance.
- **L6:** Capabilities and budgets.
- **L7:** pg-boss task routing under the cron consumer model.
- **L8:** Verification Engine.
- **L9:** Model Gateway.
- **L10:** Reference worker BP-002 end-to-end, then autonomy gating.

Only one loop is open at a time. A loop closes only when its specified acceptance tests are green and no architecture questions remain.

## 8. Current production gate: L0 RED

Worker Engine implementation is currently blocked because the repository cannot yet reproduce the production foundation from a blank database.

The current evidence is recorded in `docs/L0_RECOVERY_EVIDENCE_2026-08-10.md`.

Key findings now verified against production:

- Production migration ledger currently contains **552** rows.
- The last known clean-rebuild run captured **339 repository migration files** and failed before applying the first migration because `public.schools` was absent from the blank database.
- Main subsequently received security/grant migration changes; the repository/live version reconciliation must therefore be recomputed rather than relying on the earlier 546/339 snapshot.
- Production currently contains **413 public tables, 19 public views, 871 public functions, 636 public policies, and 210 non-internal triggers**.
- Every public table currently has RLS enabled; one table additionally has FORCE RLS.
- The production database contains **541 SECURITY DEFINER public functions**. Nine SECURITY DEFINER functions are executable by `anon`; these are an explicit review set, not automatically declared vulnerabilities because some are intentional public request gates/read counters.
- All SECURITY DEFINER public functions currently have an explicit `search_path` configuration in `pg_proc.proconfig`; no unset-search-path SECURITY DEFINER functions were found in the sampled production query.
- The HQ/workforce surface is materially larger than a single worker table. It includes worker, skill, certification, run, handoff, context, routing, verification, memory, security, and governance tables.
- Most HQ/workforce tables do **not** currently contain `school_id`. This does not authorize blindly adding the column: L0/L1 must first classify each object as platform-global control-plane state or school-scoped operational state. School-scoped objects must then satisfy the frozen security contract.

### L0 exit criteria

L0 cannot close until all are true:

1. Production migration history is preserved; no applied ledger entries are rewritten or deleted.
2. A data-free, deterministic foundation is reconstructed from authoritative evidence.
3. Blank rebuild reaches the latest repository migration successfully.
4. TBL-011 passes its required ledger, schema/RLS, and verification checks.
5. TBL-012 production-target schema reconciliation passes, with intentional differences documented.
6. RPC inventory is reconciled and hardened; no anonymous bypass remains.
7. `service_role` is absent from runtime application paths.
8. Security advisors and relevant TypeScript/build checks are green.
9. The HQ/workforce contract mapping is complete enough to identify every canonical contract's existing production source and every security gap.

## 9. Existing workforce implementation: consolidation decision

The repository already contains substantial HQ/workforce-related schema and application components. The architectural ruling is **absolute consolidation**: the existing `hq_*` workforce implementation is the proto-Worker Engine, and the frozen Worker Engine is its Governance, Lifecycle, and Enforcement Layer.

We will not create a parallel `worker_*` workforce subsystem merely because the existing tables do not yet match the frozen contracts.

The mapping must distinguish at least these existing concepts:

| Existing area | Frozen contract target | Current evidence |
|---|---|---|
| `hq_workforce_workers` | WorkerRecord | Worker identity, department/job, status, permissions, approval boundaries, KPIs exist; no `school_id` currently present |
| `hq_workforce_skills` | Skill / Blueprint skill component | Versioned skills, lane, context, procedure, verification and recovery exist |
| `hq_workforce_worker_skills` | Worker capability/skill binding | Worker-to-skill binding exists; no `school_id` currently present |
| `hq_workforce_worker_certifications` / `hq_workforce_certification_results` | Certification | Certification version/checks/evidence exist; no `school_id` currently present |
| `hq_workforce_runs` | Task/run execution evidence | Worker, skill, trigger, status, authority result and execution evidence exist |
| `hq_workforce_handoffs` | Routing/context transfer | Lane-to-lane worker handoff and materialized context exist |
| `hq_context_scopes` / `hq_context_sources` / `hq_context_facts_cache` | Context envelope/source layer | Scope, source, freshness, confidence and evidence concepts exist |
| `hq_workforce_outcome_verifications` | Verification | Outcome verification exists as a first-class production object |
| `hq_workforce_memory_entries` and related learning tables | Operational memory | Existing workforce learning/memory structures exist |
| HQ policy/decision/audit tables | Governance/authority/audit layer | Existing HQ control-plane tables already implement parts of the frozen governance boundary |

This mapping is evidence that the new Worker Engine should be implemented as **convergence and hardening of the existing workforce**, not as a greenfield parallel system.

## 10. Production safety rules

- Never use production as a migration laboratory.
- Never repair migration history by deleting or rewriting live ledger rows.
- Never use production data in a baseline migration.
- Never add guessed tables solely to make CI green.
- Never introduce Worker Engine tables while L0 is red.
- Never add `school_id` to every HQ table indiscriminately; first classify platform-global versus school-scoped contracts.
- Every production write requires a named target, preflight evidence, expected impact, and recovery plan.
- Any newly discovered architectural decision pauses coding until the freeze is amended.

## 11. Decision record

**Decision:** Accept Worker Engine Architecture Freeze v1 as the implementation contract.  
**Implementation status:** Not started beyond foundation verification.  
**Current gate:** L0 RED.  
**Next authorized activity:** Resolve the reproducible migration/foundation blocker and complete RPC/security inventory.  
**First Worker Engine coding gate:** L1 only after L0 is GREEN.

This document is a design record. It does not itself perform or authorize a database migration.
