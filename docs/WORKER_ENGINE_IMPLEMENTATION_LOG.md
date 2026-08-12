# Worker Engine Implementation Log

Updated: 2026-08-12
Active branch: `feat/worker-engine-reference-loop-20260812`
Stacked PR: #91 on top of Worker Engine PR #90

## Current mission

Prove one bounded Operations reference worker can traverse the governed lifecycle and autonomously perform real Vibeschool work through deterministic authority, execution, verification, recovery and recertification controls.

**Mission status: ✅ TARGET ACHIEVED ON WORK BRANCH / ISOLATED PREVIEW DATABASE**

This does not mean broad autonomous worker generation is enabled. It means the reference-worker architecture is mechanically demonstrated and ready for protected promotion review.

## WE-L1 — Authority & Lifecycle Convergence

Status: ✅ VERIFIED COMPLETE ON WORK BRANCH

Implemented and verified:
- canonical contract registry primitive;
- Blueprint + WorkerCreationContract authority ceilings;
- canonical lifecycle event ledger and single transition writer;
- compatibility mapping for legacy worker states without rewriting production rows;
- expiring/revocable WorkerIdentity;
- enforceable capability grants;
- transactional worker execution budgets;
- immutable issued contracts and lifecycle history;
- approved-blueprint immutability;
- capability/creation authority-ceiling enforcement;
- negative tests for illegal lifecycle transitions, contract/blueprint/lifecycle tampering, missing identity/capability, budget exhaustion and immediate revocation.

Original WE-L1 validation included migration-security, TBL-011, TBL-012, TypeScript/build and isolated SQL acceptance passes.

## WE-L2 — Governed Execution Foundation

Status: ✅ VERIFIED FOR REFERENCE-WORKER SCOPE

Implemented and verified:
- canonical TaskContract runtime;
- allowlisted ToolContract registry;
- idempotency keys;
- lease/visibility timeout;
- bounded retry/backoff and dead-letter handling;
- transactional budget reservation/consume/release;
- Tool Gateway checks active lifecycle, WorkerIdentity, certification, capability, exact semantic scope and budget before effects;
- first real deterministic side-effect adapter: `work_item.triage_and_own`;
- immutable TaskContract fields;
- failed execution releases reserved budget;
- duplicate idempotency is denied;
- wrong-scope execution fails closed/dead-letters;
- exhausted budget caps real execution.

Semantic rule: a task reaching `completed` is execution evidence only. Business success is represented by independent verification.

## WE-L3 — Shadow, Certification & Remediation

Status: ✅ VERIFIED FOR REFERENCE-WORKER SCOPE

Implemented and verified:
- production-effect-free SHADOW evidence records (`side_effects_applied=false` enforced);
- minimum three independently verified shadow outcomes before certification;
- worker cannot act as its own verifier;
- certification issuance, expiry assertion and revocation;
- certification records are immutable except allowed active -> revoked/expired transitions;
- ACTIVE -> SUSPENDED -> REMEDIATION transition revokes certification, identity, capabilities and budgets;
- remediation accepts fresh shadow-equivalent evidence;
- recertification requires fresh evidence newer than the previous certification;
- wall-clock timestamps are used for evidence/certification ordering to avoid PostgreSQL transaction-stable `now()` errors;
- collision-proof UUID-backed certification keys;
- recertified worker can be re-provisioned and successfully execute verified work again.

## WE-L4 — Autonomous Heartbeat

Status: ✅ VERIFIED FOR BOUNDED OPERATIONS REFERENCE LOOP

Implemented and verified:
- deterministic detector finds only eligible Operations work items;
- approval-required work is not autonomously assigned;
- non-Operations work is not autonomously assigned;
- detector creates idempotent TaskContracts;
- heartbeat performs detect -> execute -> verify in one bounded cycle;
- verified work is marked `resolved` only after independent outcome verification passes;
- revoked/non-certified worker cannot receive newly detected work;
- heartbeat run history is guarded against deletion/tampering after completion;
- governed scheduler entry point `hq_workforce_scheduled_heartbeat()` exists;
- engine contract contains `heartbeat_enabled` and `heartbeat_limit`;
- scheduler is **disabled by default**;
- migration conditionally registers the heartbeat with `pg_cron` only when that extension exists.

Preview limitation/evidence: the isolated preview project does not expose `pg_cron`, so cron registration itself was not executed there. The scheduled entry point was tested and correctly returned disabled state. The migration is fail-safe when `pg_cron` is absent.

## WE-L5 — Deterministic-First Model Gateway

Status: ✅ VERIFIED FOR BOUNDED AUTHORIZATION/ACCOUNTING

Implemented and verified:
- model use requires ACTIVE lifecycle, valid identity and valid certification;
- reason code is allowlisted;
- deterministic-failure evidence is mandatory before a model invocation can be authorized;
- token budget is reserved transactionally;
- failed model invocation releases reserved tokens;
- successful invocation consumes reserved tokens;
- model invocation core contract is immutable;
- only authorized -> completed/failed is allowed;
- Model Gateway cannot create worker authority or bypass Tool Gateway.

No external model call is required to prove this governance layer; this phase verifies authorization and accounting boundaries, not model quality.

## WE-L6 — Operations Reference Worker

Status: ✅ MISSION TARGET ACHIEVED

Reference trace proven in isolated preview:

```text
bootstrap worker
-> approved Blueprint + WorkerCreationContract
-> REQUESTED
-> INSTANTIATED
-> PROVISIONED
-> SHADOW
-> 3 independently verified shadow outcomes
-> CERTIFICATION_PENDING
-> CERTIFIED
-> ACTIVE
-> provision identity/capability/budgets
-> heartbeat detects eligible Operations work
-> canonical TaskContract issued
-> Tool Gateway rechecks lifecycle/identity/certification/capability/scope/budget
-> real `hq_work_items` mutation
-> execution completes
-> independent deterministic verification
-> task verification = verified
-> work item = resolved + verified
```

Adversarial/recovery trace proven:

```text
self-verification -> denied
approval-required work -> not assigned
wrong department -> not assigned
TaskContract tamper -> denied
wrong scope -> denied/dead-lettered
budget exhausted -> further real execution denied
AI without deterministic-failure evidence -> denied
failed model call -> budget released
successful bounded model authorization -> budget consumed
suspend worker -> certification/identity/capabilities/budgets revoked
new work while revoked -> not assigned
REMEDIATION -> 3 fresh verified remediation outcomes
-> recertification
-> new identity/capability/budget
-> ACTIVE
-> post-remediation autonomous work -> executed + independently verified + resolved
verification evidence deletion -> denied
completed heartbeat tamper -> denied
```

## Repository and runtime audit evidence

Reference-loop implementation was database-tested on hardened head `a79e61de1591a0d3f96f9ed3c05aba58f2afe0c8`. The final documentation-only evidence update moved PR #91 to head `e7d05d419a2d4aa2448ce267d2b5b02f90862097`; no runtime code changed after the green database head.

- TBL-011 Isolated Clean Rebuild: ✅ PASS on runtime head `a79e61de...` (run 374).
- TBL-012 M(repo) extractor: ✅ PASS on runtime head `a79e61de...` (run 49).
- All WE-L3..WE-L6 migrations applied successfully in the isolated Supabase preview project.
- Full reference-worker mission acceptance: ✅ PASS.
- Budget/scope attack fixture: ✅ PASS.
- Post-hardening heartbeat/model/tamper fixture: ✅ PASS.
- New runtime evidence tables inspected: RLS enabled, zero direct RLS policies.
- Key new privileged Worker Engine routines expose no `PUBLIC`, `anon` or `authenticated` execute grants.
- New runtime tables expose service-role access only in the inspected preview state.
- PR #91 is open, draft and mergeable; final review/promotion remains separate from mission proof.

TypeScript/build is not used as the stopping criterion for this database-first reference mission. It remains a promotion gate before eventual merge to `main`.

## Security invariants demonstrated

1. Execution cannot occur without identity.
2. Execution cannot occur without valid certification.
3. Execution cannot occur outside ACTIVE lifecycle.
4. Execution cannot occur without capability.
5. Execution cannot exceed exact task/capability scope.
6. Execution cannot exceed transactional budget.
7. Tool execution is allowlisted rather than arbitrary SQL/function execution.
8. Shadow work cannot claim production effects.
9. Worker cannot certify/verify itself.
10. Business success requires independent outcome verification.
11. Revocation removes live authority immediately.
12. Remediation requires fresh evidence before recertification.
13. AI authorization requires proof that deterministic handling was insufficient plus token budget.
14. Core contracts/evidence are mechanically protected from mutation.
15. Autonomous heartbeat is bounded and independently switchable, default OFF.

## Production status

**NOT MERGED / NOT DEPLOYED.**

- `main` remains untouched by this mission branch.
- production Supabase remains untouched by WE-L1..WE-L6 migrations.
- Vercel remains untouched.
- autonomous heartbeat remains disabled by default even when the migrations are eventually applied.

## Current boundary / next mission

The current reference-worker mission is complete. The next distinct mission is **WE-L7 Worker Factory V2 / autonomous workforce generation**, which must build on this proven kernel:

DemandEvidence -> diagnose eliminate/redesign/automate/train/rebalance/temp/human/new-worker -> approved creation contract -> generate -> provision -> SHADOW -> verify -> certify -> ACTIVE.

WE-L7 is deliberately **not** marked complete here and should not be enabled until PR #90/#91 are reviewed/promoted through the protected workflow.