# VibeSchool Task 15 — HQ Workforce Control Room Handover

## Status

**IN PROGRESS / SHARED-FOUNDATION HOLD**

Draft PR: **#290**. Branch: `agent/task15-hq-workforce-control-room`.

Task 15 must remain unmerged until all shared foundations ahead of it have merged and exact-current-main certification is repeated. Worker Engine production activation remains a separate governed decision.

## Starting state

- Starting/current `main`: `77051a4011d7712a275f76af41efed382f017398`.
- Existing HQ surface: `app/hq/workforce/page.tsx` with Overview, Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.
- Existing owner read RPC: `hq_workforce_get_control_room_snapshot(integer)`.
- Existing owner review RPC: `hq_workforce_owner_review_shadow_decision(uuid,text,text)`.
- Existing runtime primitives on repository main: owner runtime policy, owner runtime start/stop, owner capability-authority lifecycle, deterministic execution breakers.

## Production read-only baseline — 2026-08-19

Production was inspected using SELECT/catalog/advisor reads only.

Observed authoritative state:

- runtime execution: OFF
- autonomy: L0
- maximum risk: R0
- heartbeat: OFF
- factory: OFF
- shadow execution: OFF
- shadow scheduler: OFF
- Global Stop: ACTIVE
- active global runtime policy: 0
- active R1.4 capability authority: 0
- active legacy/foundational worker capability grants: 0
- tripped global execution breaker rows: 0
- active workers: 10
- open operational work items: 48
- open owner shadow decisions: 1

Production contains three currently certified L1/R1 content capability packages (`content.authoring.source_grounded`, `content.evidence.semantic_verify`, `content.research.execute`) with certified skills and approved tool contracts. However, zero active foundational worker capability grants means no worker is currently eligible for consequential autonomous authority. Task 15 deliberately surfaces that commissioning gap instead of manufacturing authority.

### Production drift discovered

Repository function `hq_workforce_owner_set_runtime` references `hq_workforce_capability_authority_grants.effective_from`, but production has no `effective_from` column. Production uses lifecycle timestamps including `issued_at`, `certified_at`, `activated_at` and `expires_at`.

This is a shared Worker Engine / migration-integrity dependency. Task 15 does not mutate production to repair it and does not weaken activation checks around it. Final activation simulation is blocked until the canonical upstream function is reconciled.

## Task 15 branch changes

### Canonical HQ Control Room

The existing Workforce page is retained and promoted into the canonical `Control Room` entry surface rather than replaced by another administration application.

Control Room presents:

- authoritative Runtime ON/OFF
- autonomy level
- maximum risk
- Global Stop state
- owner-operation RPC availability
- active temporary authority count
- active worker count
- open decisions
- breaker count
- heartbeat/factory/anomaly state
- authority-readiness prerequisites
- explicit global operating envelope
- temporary authority detail and lifecycle actions
- circuit-breaker history/state and bounded recovery
- recent governed task executions
- enforceable execution-budget windows
- owner control audit trail

Detailed tabs remain: Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.

If Task 15 operational RPCs are not commissioned in the target environment, the UI fails into a visible read-only mode rather than presenting fake controls.

### Authority readiness and temporary draft creation

Added owner-gated `hq_workforce_owner_authority_catalog(integer)`. It exposes only packages that already satisfy foundational Worker Engine prerequisites:

- active worker lifecycle
- active canonical worker identity
- worker certification
- certified capability version
- certified, unexpired implementing skill
- approved matching tool contract
- active, unexpired foundational `hq_workforce_capability_grants` authority
- scope allowed by the certified skill
- active execution budget
- no overlapping nonterminal R1.4 authority grant

The Control Room shows counts for certified packages, active identities, foundational grants, active budgets and eligible packages. When prerequisites are absent it explicitly explains the missing commissioning boundary.

Added owner-gated `hq_workforce_owner_issue_authority_draft(...)`. The browser supplies only bounded operating limits and an audit reason. The server derives worker/capability/skill/tool/scope, required autonomy/risk, verification, compensation, preconditions and maximum effective expiry from canonical backend truth, then calls the existing service-only `hq_workforce_issue_capability_authority_draft(...)` constructor.

The bridge can create **DRAFT only**. It cannot create worker identity, certification, foundational capability authority, budgets, runtime policy or active R1.4 authority. It requires runtime OFF and rejects overlapping nonterminal authority.

A contract review caught and fixed a verification-shape mismatch before certification: the canonical R1.4 constructor requires a JSON object for `verification_contract`; the Task 15 bridge now supplies an object carrying the certified capability verification contract, skill verification requirement and tool binding.

Owner lifecycle remains:

- eligible certified package -> Create temporary authority draft
- Draft -> Certify
- Certified -> Activate
- Active -> Suspend
- Draft/Certified/Active/Suspended -> Revoke

Authority activation is rejected server-side while Global Stop is active, including direct RPC manipulation.

### Safety envelope

The owner can configure actual global runtime policy ceilings from HQ while runtime is OFF:

- policy enabled/disabled state
- maximum autonomy
- maximum risk
- concurrency ceiling
- execution-rate ceiling
- explicit reason and typed confirmation

`hq_workforce_owner_configure_global_envelope(...)` is owner-gated, stale-state protected and cannot start runtime.

### Start Controlled Operations

The UI is not a raw ON switch. Activation review shows Runtime OFF -> ON, current -> proposed autonomy/risk, active temporary authority and global policy ceilings.

The backend requires `hq_assert_owner()`, authenticated owner identity, a current engine `updated_at` stale-state token, Global Stop released, existing canonical runtime activation invariants and explicit audit reason. Activation never creates capability authority automatically.

### Stop Operations

Normal Stop is distinct from Global Stop. It invokes canonical shutdown when needed, produces OFF/L0/R0, suspends all active R1.4 authority, performs authority cleanup even if runtime was already OFF, records owner evidence and is idempotent only when both runtime posture and authority cleanup are already satisfied.

### Global Stop

Emergency Global Stop forces runtime OFF/L0/R0, disables heartbeat/factory/shadow scheduling, activates Global Stop, trips deterministic breaker reason `owner_global_stop`, suspends active R1.4 authority, preserves evidence and records owner action evidence.

Releasing Global Stop resets only tripped global breakers with reason `owner_global_stop`, leaves unrelated anomaly/budget/operator breakers intact, leaves runtime OFF/L0/R0 and heartbeat/factory OFF, and never reactivates authority or workers.

Non-global breaker reset requires owner authorization and runtime OFF. Global breaker recovery is routed through Global Stop semantics.

### Owner audit ledger

Added `hq_workforce_owner_control_events` with RLS enabled and direct public/anon/authenticated access revoked. Service transport receives SELECT only; owner-facing reads occur through an owner-gated RPC. Evidence includes actor, previous/requested/result state, outcome, reason and timestamp.

## Security posture

New owner RPCs are `SECURITY DEFINER` with fixed `search_path`, call `hq_assert_owner()`, require authenticated owner identity where consequential, and are denied to `public`, `anon` and `service_role`; authenticated callers can reach the RPC boundary but canonical owner authorization remains authoritative.

No direct owner-control table mutation permission is granted to ordinary authenticated users. Task 15 migrations are non-activating and do not issue active authority during installation.

Production Supabase security advisors still report broader pre-existing warnings such as mutable search paths/permissive policy debt. Those are shared-foundation work, especially Task 2/Task 8; Task 15 does not claim they are resolved.

## Regression protection

Added/strengthened:

- `scripts/verify-task15-control-room.mjs`
- `.github/workflows/task15-control-room-contract.yml`
- `supabase/tests/task15_hq_workforce_control_room.sql`

Contracts cover owner gating, privileged-function posture, direct audit-table DML denial, fixed `search_path`, stale-state protection, deliberate confirmation, non-activating policy adjustment, authority-readiness prerequisites, canonical draft construction, runtime-off draft authoring, overlapping authority denial, Stop/Global Stop separation, Stop cleanup from an already-OFF runtime, Global Stop authority neutralization, Global Stop release isolation from unrelated breakers, direct authority activation denial during Global Stop, breaker recovery semantics, audit evidence, safe read-only fallback and held-lane OFF/L0/R0.

A full role/JWT behavior matrix and dynamic A–J failure injection remain required in the disposable exact candidate after shared identity/security foundations settle.

## Dependency tracking

| Dependency | Status | Task 15 impact |
|---|---|---|
| Task 2 database migration integrity / PR #282 | OPEN / HOLD | Must reconcile clean reconstruction and repository↔production Worker Engine drift. |
| Task 8 authorization/privacy / PR #288 | OPEN / HOLD | Must re-run owner/non-owner RPC abuse matrix after canonical auth changes. |
| Task 12 telemetry / PR #289 | OPEN / HOLD | Health/failure UI must consume the final shared observability contract. |
| Worker Engine commissioning repair / PR #279 | OPEN / HOLD | Must reconcile owner-runtime migration lineage and `effective_from` drift; foundational worker authority remains uncommissioned in production. |
| Task 14 incident controls | concurrent dependency | Failure/containment integration must be rechecked when shared incident contracts land. |

## CI / deployment evidence

Earlier non-cancelled branch evidence included a successful production build. The first Migration Security run failed only because the new restricted audit table lacked repository-required `access:` / `authorization-test:` declarations; those declarations were added.

The current branch head after authority-readiness wiring is `9b2e708371ec01cc79956f83b9ebe3571baff642`. GitHub Actions had not yet attached completed runs to that exact head at the latest check, so old green evidence is not being promoted to exact-head certification.

A repository integration automatically triggered Netlify deploy previews. This was not intentionally requested as part of Task 15 and is not production certification. No Vercel deployment was intentionally triggered. Preview behavior remains an environment-policy concern against the standing preview-disable rule.

## Required final certification after shared foundations merge

1. Fetch exact current `main` and record its SHA.
2. Reconcile/rebase this branch.
3. Inspect every Worker Engine/HQ migration and RPC changed upstream.
4. Reinspect production read-only.
5. Resolve repository↔production authority-timestamp drift through the owning shared foundation.
6. Re-evaluate production foundational worker identity/capability/budget commissioning; Task 15 must not synthesize missing prerequisites.
7. Run isolated clean reconstruction including every Task 15 migration.
8. Run Migration Security and Supabase security advisors against the isolated candidate.
9. Prove anonymous, student, parent, teacher, school-admin and non-owner authenticated callers cannot execute Task 15 consequential RPCs.
10. Prove frontend/direct-RPC parameter manipulation and stale `updated_at` requests fail closed.
11. Simulate duplicate Start, duplicate Stop, expired authority, over-risk request, exhausted budget, open breaker, Global Stop active, worker failure, Stop during active work and network-loss retry behavior in disposable infrastructure.
12. Prove authority draft -> certify -> activate -> expire -> consequential operation denied.
13. Run Worker Engine governance, incident-control and telemetry contract gates.
14. Run TypeScript, lint and production build on the exact candidate.
15. Test Control Room, authority readiness, decisions, activation review, Stop and Global Stop at phone widths.
16. Keep production OFF/L0/R0/Global Stop ACTIVE unless a separately approved operational-autonomy decision authorizes otherwise.
17. Only after every shared dependency and exact-head gate is green may Task 15 merge and receive its intended final application deployment.

## Production safety record

During Task 15 work so far:

- no production Supabase mutation
- no production migration application
- no production RLS/grant change
- no production data repair
- no Edge Function deployment
- no Worker Engine runtime activation
- no production authority issuance
- no Global Stop release
- no intentional Vercel deployment

Production Supabase access has been read-only investigation/advisor inspection only.
