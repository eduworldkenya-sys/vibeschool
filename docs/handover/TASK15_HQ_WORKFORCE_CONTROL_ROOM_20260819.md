# VibeSchool Task 15 — HQ Workforce Control Room Handover

## Status

**IN PROGRESS / SHARED-FOUNDATION HOLD**

Draft PR: **#290**. Branch: `agent/task15-hq-workforce-control-room`.

Task 15 must remain unmerged until all shared foundations ahead of it have merged and exact-current-main certification is repeated. Worker Engine production activation remains a separate governed decision.

## Starting state

- Starting `main`: `77051a4011d7712a275f76af41efed382f017398`.
- Existing HQ surface: `app/hq/workforce/page.tsx` with Overview, Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.
- Existing owner read RPC: `hq_workforce_get_control_room_snapshot(integer)`.
- Existing owner review RPC: `hq_workforce_owner_review_shadow_decision(uuid,text,text)`.
- Existing runtime primitives on repository main: owner runtime policy, owner runtime start/stop, owner capability-authority lifecycle, deterministic execution breakers.

## Production read-only baseline — 2026-08-19

Production project was inspected with SELECT/catalog/advisor reads only.

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
- tripped global execution breaker rows: 0
- active workers: 10
- open operational work items: 48
- open owner shadow decisions: 1

The owner runtime/control functions are present in production, including `hq_workforce_owner_set_runtime`, `hq_workforce_owner_put_runtime_policy`, and `hq_workforce_owner_transition_capability_authority`.

### Production drift discovered

Repository function `hq_workforce_owner_set_runtime` currently references `hq_workforce_capability_authority_grants.effective_from`, but production has no `effective_from` column. Production uses lifecycle timestamps including `issued_at`, `certified_at`, `activated_at` and `expires_at`.

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
- explicit global operating envelope
- temporary authority detail and lifecycle actions
- circuit-breaker history/state and bounded recovery
- recent governed task executions
- enforceable execution-budget windows
- owner control audit trail

Detailed tabs remain: Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.

If Task 15 operational RPCs are not commissioned in the target environment, the UI fails into a visible read-only mode rather than presenting fake controls.

### Safety envelope

The owner can configure the actual global runtime policy ceilings from HQ while runtime is OFF:

- policy enabled/disabled state
- maximum autonomy
- maximum risk
- concurrency ceiling
- execution-rate ceiling
- explicit reason and typed confirmation

`hq_workforce_owner_configure_global_envelope(...)` is owner-gated, stale-state protected and cannot start runtime.

### Start Controlled Operations

The UI is not a raw ON switch.

Activation review shows:

- Runtime OFF -> ON
- current -> proposed autonomy
- current -> proposed maximum risk
- active temporary authority count
- global policy ceilings

The backend wrapper requires:

- `hq_assert_owner()`
- authenticated owner identity
- current expected engine `updated_at` stale-state token
- Global Stop released
- existing canonical runtime activation invariants
- explicit audit reason

Activation never creates capability authority automatically.

### Temporary authority

Existing governed capability-authority grants are understandable in HQ by capability/version, worker scope, operation/resource, autonomy/risk, lifecycle state and expiry.

The owner can perform governed lifecycle transitions without direct table writes:

- Draft -> Certify
- Certified -> Activate
- Active -> Suspend
- Draft/Certified/Active/Suspended -> Revoke

Authority activation is rejected server-side while Global Stop is active, even if a caller manipulates the frontend or invokes the RPC directly.

Initial authority-draft authoring remains owned by the existing certified capability/skill/tool pipeline (`hq_workforce_issue_capability_authority_draft`) rather than letting the browser invent execution contracts. This must be re-evaluated after Worker Engine commissioning PR #279 lands; the final owner journey must not require routine SQL.

### Stop Operations

Normal Stop is distinct from Global Stop.

Normal Stop:

- invokes canonical owner runtime shutdown when needed
- produces OFF / L0 / R0
- suspends every currently active R1.4 capability-authority grant
- performs authority cleanup even if runtime was already OFF
- records owner control evidence
- is idempotent only when both runtime posture and authority cleanup are already satisfied

### Global Stop

Emergency Global Stop:

- forces runtime OFF / L0 / R0
- disables heartbeat and factory
- disables shadow execution/scheduler
- sets Global Stop active
- trips deterministic global breaker reason `owner_global_stop`
- suspends active R1.4 capability authority
- preserves evidence
- records owner action evidence

Releasing Global Stop:

- resets only tripped global breakers with reason `owner_global_stop`
- does **not** clear unrelated anomaly/budget/operator breakers
- leaves runtime OFF / L0 / R0
- leaves heartbeat/factory OFF
- does not reactivate authority
- does not start workers automatically

Non-global breaker reset requires owner authorization and runtime OFF. Global breaker recovery is routed through Global Stop semantics to avoid bypassing emergency containment.

### Owner audit ledger

Added `hq_workforce_owner_control_events` with RLS enabled and direct public/anon/authenticated access revoked. Owner-facing reads occur through the owner-gated snapshot; service transport receives SELECT only.

Recorded state includes actor, previous state, requested state, result state, outcome, reason and timestamp.

## Security posture

New consequential RPCs are `SECURITY DEFINER` with fixed `search_path`, call `hq_assert_owner()`, require authenticated owner identity and are denied to `public`, `anon` and `service_role`; authenticated callers can reach the RPC boundary but canonical owner authorization remains authoritative.

No direct owner-control table mutation permission is granted to ordinary authenticated users.

Task 15 migrations are non-activating and do not issue authority during installation.

## Regression protection

Added:

- `scripts/verify-task15-control-room.mjs`
- `.github/workflows/task15-control-room-contract.yml`
- `supabase/tests/task15_hq_workforce_control_room.sql`

The contracts cover:

- owner gate presence and privileged-function posture
- direct audit-table DML denial
- fixed `search_path`
- stale-state protection
- deliberate confirmation contract
- non-activating global-policy adjustment
- Stop/Global Stop separation
- Stop cleanup from an already-OFF runtime
- Global Stop authority neutralization
- Global Stop release isolation from unrelated breakers
- direct authority activation denial during Global Stop
- breaker recovery runtime-off semantics
- audit evidence
- safe missing-RPC/read-only fallback
- held-lane OFF/L0/R0 invariant

A full role/JWT behavior matrix and dynamic failure injection remain required in the disposable exact-candidate database after shared identity/security foundations settle.

## Dependency tracking

| Dependency | Status | Task 15 impact |
|---|---|---|
| Task 2 database migration integrity / PR #282 | OPEN / HOLD | Must reconcile clean reconstruction and repository↔production Worker Engine drift. |
| Task 8 authorization/privacy / PR #288 | OPEN / HOLD | Must re-run owner/non-owner RPC abuse matrix after canonical auth changes. |
| Task 12 telemetry / PR #289 | OPEN / HOLD | Health/failure UI must consume the final shared observability contract. |
| Worker Engine commissioning repair / PR #279 | OPEN / HOLD | Must reconcile owner-runtime migration lineage and `effective_from` drift; also re-evaluate authority-draft owner workflow. |
| Task 14 incident controls | concurrent dependency | Failure/containment integration must be rechecked when shared incident contracts land. |

## CI / deployment evidence

GitHub Actions for the current branch have been triggered, including Task 15 Control Room Contract, Migration Security, clean rebuild, Worker Engine acceptance, TypeScript and production-build gates. Their results must be recorded only after they complete on the exact current branch head.

A repository integration automatically triggered a **Netlify deploy-preview** for the branch and GitHub reported it successful. This was not intentionally requested as part of Task 15 and is not production certification. No Vercel deployment was intentionally triggered. The preview behavior is an environment-policy concern to reconcile with the standing preview-disable rule.

## Required final certification after shared foundations merge

1. Fetch exact current `main` and record its SHA.
2. Reconcile/rebase this branch.
3. Inspect every Worker Engine/HQ migration and RPC changed upstream.
4. Reinspect production read-only.
5. Resolve repository↔production authority-timestamp drift through the owning shared foundation; do not patch production ad hoc from Task 15.
6. Run isolated clean reconstruction including every Task 15 migration.
7. Run Migration Security and Supabase security advisors against the isolated candidate.
8. Prove anonymous, student, parent, teacher, school-admin and non-owner authenticated callers cannot execute Task 15 consequential RPCs.
9. Prove frontend/direct-RPC parameter manipulation and stale `updated_at` requests fail closed.
10. Simulate duplicate Start, duplicate Stop, expired authority, over-risk request, exhausted budget, open breaker, Global Stop active, worker failure, Stop during active work and network-loss retry behavior in disposable infrastructure.
11. Prove authority issued -> active -> expired -> consequential operation denied.
12. Run Worker Engine governance, incident-control and telemetry contract gates.
13. Run TypeScript, lint and production build on the exact candidate.
14. Test Control Room, decision inspection, activation review, Stop and Global Stop at phone widths.
15. Keep production OFF / L0 / R0 / Global Stop ACTIVE unless a separately approved operational-autonomy decision authorizes otherwise.
16. Only after every shared dependency and exact-head gate is green may Task 15 merge and receive its intended final application deployment.

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
