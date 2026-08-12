# Worker Engine Implementation Log

Updated: 2026-08-12
Canonical repository state: `main`
Merged implementation PRs: #90 -> #91 -> #92

## Current mission

Build one governed autonomous Worker Engine that can detect sustained workforce need from Vibeschool telemetry, diagnose whether a new worker is justified, create a bounded digital worker only when earlier remedies are insufficient, qualify/certify it safely, activate it, route real work through the existing execution kernel, independently verify outcomes, and prefer reuse/rebalancing before duplicate creation.

**Mission status: ✅ MERGED TO `main` AND VERIFIED THROUGH WE-L13.**

This does not authorize unrestricted worker generation or production autonomy. The engine remains template-governed and autonomous scheduler/factory activation remains default OFF.

## WE-L1 — Authority & Lifecycle Convergence
Status: ✅ VERIFIED AND MERGED

Canonical contracts, Blueprint + WorkerCreationContract authority ceilings, lifecycle ledger, expiring/revocable WorkerIdentity, enforceable capabilities, transactional budgets, immutable authority contracts, and negative authority tests.

## WE-L2 — Governed Execution Foundation
Status: ✅ VERIFIED AND MERGED

TaskContract, ToolContract, idempotency, lease timeout, bounded retry/backoff, dead-letter handling, transactional budget reserve/consume/release, Tool Gateway, deterministic `work_item.triage_and_own` side effect, and independent verification.

## WE-L3 — Shadow, Certification & Remediation
Status: ✅ VERIFIED AND MERGED

No-side-effect SHADOW evidence, independent verification, no self-verification, certification/expiry/revocation, suspension/remediation, fresh-evidence recertification, wall-clock ordering, and collision-proof certification keys.

## WE-L4 — Autonomous Heartbeat
Status: ✅ VERIFIED AND MERGED FOR BOUNDED OPERATIONS LOOP

Deterministic eligible-work detection, idempotent task issuance, detect -> execute -> verify cycle, approval/non-Operations exclusion, governed scheduler entrypoint, and default-OFF activation contract.

## WE-L5 — Deterministic-First Model Gateway
Status: ✅ VERIFIED AND MERGED

Model use only after deterministic insufficiency evidence, active identity/certification checks, allowlisted reasons, token-budget reserve/release/consume, and immutable invocation accounting.

## WE-L6 — Reference Operations Worker
Status: ✅ VERIFIED AND MERGED

Full lifecycle and adversarial recovery proven: bootstrap -> SHADOW -> certify -> ACTIVE -> real work -> independent verification; revocation/suspension/remediation/recertification; wrong scope/budget/self-verification/approval-required paths fail closed.

## WE-L7 — Governed Worker Factory V2
Status: ✅ VERIFIED AND MERGED

Sealed DemandEvidence, deterministic quantified diagnosis, bounded Blueprint/creation contract, paid-AI-off generation, allowlisted tool adapter, SHADOW-only creation, and no live authority before certification.

## WE-L8 — Telemetry-Driven Factory
Status: ✅ VERIFIED AND MERGED

Immutable approved FactoryTemplate registry, authoritative demand metrics from runtime state, deterministic worker keys, factory default OFF, and fail-closed behavior for unknown/unapproved worker types.

## WE-L9 — Autonomous Qualification + Generic Dispatch
Status: ✅ VERIFIED AND MERGED

Immutable qualification cases, deterministic shadow executor, independent certification, identity/capability/budget provisioning, generic capability-based Operations dispatch, and independent verification of completed work.

## WE-L10 — Reuse Before Create
Status: ✅ VERIFIED AND MERGED

Active certified capacity is authoritative evidence for reuse/rebalancing; FactoryTemplate `max_live_workers` prevents duplicate creation when existing capacity can absorb the demand.

## WE-L11 — Sustained Demand Sensor
Status: ✅ VERIFIED AND MERGED

Deterministic backlog sensor from real `hq_work_items`: 5+ eligible items, oldest >=15 minutes, 3 observations within 15 minutes, 60-minute emission cooldown, one-off spike rejection, and sustained backlog -> capacity gap with provenance.

Canonical proven chain: real backlog -> sensor -> gap -> diagnosis -> worker -> SHADOW -> qualification -> certification -> ACTIVE -> real work -> independent verification -> resolved.

## WE-L12 — Single Runtime Entrypoint
Status: ✅ VERIFIED AND MERGED

Positive service-role orchestration is reduced to `hq_workforce_scheduled_heartbeat()`. Low-level factory/diagnosis/qualification/dispatch/sensor/lifecycle functions are not direct service-role runtime entrypoints.

## WE-L13 — Legacy Lifecycle Bypass Closure
Status: ✅ VERIFIED AND MERGED

Legacy probation activation bypasses are closed. Direct lifecycle transition, shadow evidence insertion, certification issuance, legacy probation certification, and reference bootstrap are denied as service-role runtime entrypoints. CERTIFIED/ACTIVE transition requires valid certification.

## Promotion evidence

PR #90 merged WE-L1/WE-L2 after exact-head TBL-011, TBL-012, Supabase migration-security, TypeScript, ESLint, production build, and review-thread gates passed.

PR #91 merged the reference-worker autonomy loop after the same promotion-gate class was rerun against merged PR #90.

PR #92 merged WE-L7 through WE-L13 after exact-head validation against merged PRs #90 and #91:
- TBL-011 isolated clean rebuild — PASS
- TBL-012 M(repo) extractor — PASS
- Supabase Migration Security Contract — PASS
- TypeScript — PASS
- ESLint — PASS
- Next.js production build — PASS
- unresolved review threads — none

Canonical merge on `main`: `f83c6df4bccd6edbfb1b951d9fa38ec77a43091e` (`feat(worker-engine): autonomous governed Worker Factory through WE-L13 (#92)`).

## Runtime security boundary

The merged design preserves these boundaries:
- `hq_workforce_scheduled_heartbeat()` is the governed positive orchestration entrypoint;
- direct lower-level creation/lifecycle/certification execution is not a service-role runtime path;
- Worker Engine factory/runtime tables are RLS protected and privileged surfaces fail closed;
- HQ decision RPCs remain owner-gated;
- unknown worker types fail closed without an approved FactoryTemplate, deterministic tool adapter, and qualification suite.

## Production status

**MERGED TO REPOSITORY `main`; PRODUCTION AUTONOMY NOT ACTIVATED.**

- Worker Engine implementation is now present on `main`.
- No separate production Supabase mutation was performed as part of PRs #90-#92.
- Autonomous scheduler/factory remain default OFF.
- Production autonomy activation remains a separate protected decision and validation step.
- No Vercel action is required for this database-governance convergence record.

## Boundary after WE-L13

The bounded autonomy kernel mission is complete. The next distinct phase is controlled scale-out rather than more kernel invention:

1. add additional approved worker templates only with certified deterministic tool adapters and qualification suites;
2. add workforce forecasting, capacity/rebalancing and retirement policy;
3. add production-readiness evidence for scheduler/factory activation without enabling it;
4. require a separate protected promotion decision before any production autonomy is switched on.

Until those controls are proven, unknown worker types and production autonomy remain fail closed.
