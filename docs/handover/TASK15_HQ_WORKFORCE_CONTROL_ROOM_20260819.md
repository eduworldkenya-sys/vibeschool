# VibeSchool Task 15 — HQ Workforce Control Room Handover

## Status

**IN PROGRESS / SHARED-FOUNDATION HOLD**

Task 15 remains isolated on `agent/task15-hq-workforce-control-room` and must not merge until the shared foundations ahead of it have merged and exact-current-main certification is repeated.

## Starting state

- Starting `main`: `77051a4011d7712a275f76af41efed382f017398`.
- Existing HQ surface: `app/hq/workforce/page.tsx` with Overview, Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.
- Existing owner read RPC: `hq_workforce_get_control_room_snapshot(integer)`.
- Existing owner review RPC: `hq_workforce_owner_review_shadow_decision(uuid,text,text)`.
- Existing runtime primitives on repository main: owner runtime policy, owner runtime start/stop, owner capability-authority lifecycle, deterministic execution breakers.

## Production read-only baseline — 2026-08-19

Production project was inspected with SELECT/catalog queries only.

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

This is treated as a shared Worker Engine / migration-integrity dependency. Task 15 does not mutate production to repair it and does not weaken activation checks around it.

## Task 15 branch changes

### HQ Control Room

The existing Workforce page is retained and promoted into a canonical `Control Room` entry surface rather than replaced by another admin application.

Control Room now presents:

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
- temporary authority detail
- circuit-breaker history/state
- recent governed task executions
- enforceable execution-budget windows
- owner control audit trail

Existing detailed tabs remain available: Workers, Jobs, Shadow Runs, Decisions, Skills, Authority, Evidence, Failures and Resources.

### Start Controlled Operations

The UI is not a raw ON switch.

Activation requires an explicit review step and shows:

- Runtime OFF -> ON
- current -> proposed autonomy
- current -> proposed maximum risk
- active authority count
- currently permitted global policy ceilings

The backend wrapper requires:

- `hq_assert_owner()`
- authenticated owner identity
- a current expected engine `updated_at` stale-state token
- Global Stop released
- existing owner runtime activation invariants
- explicit audit reason

Activation never creates capability authority automatically.

### Stop Operations

Normal Stop is distinct from Global Stop.

Normal Stop:

- invokes canonical owner runtime shutdown
- returns runtime to OFF / L0 / R0
- suspends currently active R1.4 capability-authority grants
- records the owner control event
- supports idempotent repeated Stop

### Global Stop

Emergency Global Stop:

- forces runtime OFF / L0 / R0
- disables heartbeat and factory
- disables shadow execution/scheduler
- sets Global Stop active
- trips the deterministic global execution breaker
- suspends active R1.4 capability authority
- preserves evidence
- records owner action evidence

Releasing Global Stop:

- resets only the global prohibition
- leaves runtime OFF
- leaves heartbeat/factory OFF
- does not reactivate authority
- does not start workers automatically

### Owner audit ledger

Added `hq_workforce_owner_control_events` with RLS enabled and direct public/anon/authenticated access revoked. Owner-facing reads occur through the owner-gated snapshot; service transport receives SELECT only.

Recorded state includes actor, previous state, requested state, result state, outcome, reason and timestamp.

## Security posture

New consequential RPCs are `SECURITY DEFINER` with fixed `search_path`, call `hq_assert_owner()`, require an authenticated owner identity and are denied to `public`, `anon` and `service_role`; only authenticated callers can reach the function boundary, where owner authorization remains authoritative.

No direct table write permission is granted to ordinary authenticated users.

The migration has an explicit non-activation invariant and performs no runtime activation or authority issuance during installation.

## Regression protection

Added:

- `scripts/verify-task15-control-room.mjs`
- `.github/workflows/task15-control-room-contract.yml`

The contract asserts owner gating, stale-state protection, deliberate confirmation, Stop/Global Stop separation, authority neutralization, breaker integration, audit RLS/grants, safe missing-RPC fallback, and non-activation behavior. The workflow also runs TypeScript.

## Dependency tracking

| Dependency | Status | Task 15 impact |
|---|---|---|
| Task 2 database migration integrity / PR #282 | OPEN / HOLD | Must reconcile clean reconstruction and repository↔production Worker Engine drift. |
| Task 8 authorization/privacy / PR #288 | OPEN / HOLD | Must re-run privileged RPC grants/SECURITY DEFINER review after merge. |
| Task 12 telemetry / PR #289 | OPEN / HOLD | Control Room health/failure telemetry should consume final shared observability contract. |
| Worker Engine commissioning repair / PR #279 | OPEN | Must reconcile owner runtime/migration lineage, especially `effective_from` drift. |
| Task 14 incident controls | concurrent dependency | Failures/incidents integration must be rechecked when its shared contracts land. |

## Required final certification after shared foundations merge

1. Fetch exact current `main` and record its SHA.
2. Reconcile/rebase this branch.
3. Inspect every Worker Engine/HQ migration and RPC changed upstream.
4. Reinspect production read-only.
5. Resolve the repository↔production authority-timestamp drift through the owning shared foundation; do not patch production ad hoc from Task 15.
6. Run isolated clean reconstruction including the Task 15 migration.
7. Run Migration Security and Supabase security advisors against the isolated candidate.
8. Prove anonymous, student, parent, teacher, school-admin and non-owner authenticated callers cannot execute any Task 15 consequential RPC.
9. Prove direct RPC parameter manipulation and stale `updated_at` requests fail closed.
10. Simulate duplicate Start, duplicate Stop, expired authority, over-risk request, exhausted budget, open breaker, Global Stop, worker failure, Stop during active work and network-loss retry behavior in disposable infrastructure.
11. Run Worker Engine governance, incident-control and telemetry contract gates.
12. Run TypeScript, lint and production build on the exact candidate.
13. Test Control Room and high-risk confirmations at phone widths.
14. Keep production OFF / L0 / R0 / Global Stop ACTIVE unless a separately approved operational-autonomy decision authorizes otherwise.
15. Only after every shared dependency and exact-head gate is green may Task 15 merge and receive its intended final application deployment.

## Production safety record

During this Task 15 work so far:

- no production Supabase mutation
- no production migration application
- no production RLS/grant change
- no production data repair
- no Edge Function deployment
- no Worker Engine runtime activation
- no authority issuance
- no Global Stop release
- no intentional Vercel deployment

Production access has been read-only investigation only.
