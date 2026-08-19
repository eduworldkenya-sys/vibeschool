# VibeSchool Task 14 — Pilot Incident Control Handover

Status: **SHARED-FOUNDATION HOLD — implementation and isolated certification only**

## Foundation

- Baseline main: `77051a4011d7712a275f76af41efed382f017398`
- Branch: `task/14-pilot-incident-control-20260819`
- Production mutations: **FORBIDDEN while hold is active**
- Production deployments: **FORBIDDEN while hold is active**
- Production inspection: read-only only
- Exact-current-main certification: pending hold lift

## Canonical severity

| Severity | Meaning | Examples | Response |
|---|---|---|---|
| SEV-0 | Security/privacy or integrity emergency | cross-school/student exposure, privilege escalation, destructive autonomous action, payment integrity compromise | contain immediately; preserve evidence; owner/security review |
| SEV-1 | Pilot-critical outage/corruption | broad login/onboarding failure, learning unavailable, DB outage, widespread identity/result corruption | contain immediately; restore safest compatible service |
| SEV-2 | Major degradation | important module unavailable, cohort-limited failure, notifications/content degradation | scope containment; repair with priority |
| SEV-3 | Minor | isolated non-critical defect with workaround | normal engineering queue |

Severity is assigned from user impact, data/privacy risk and blast radius, not message appearance.

## Incident lifecycle

`Detected → Investigating → Contained → Fixing → Monitoring → Resolved`

A security/privacy incident cannot move to Resolved without containment verification and negative authorization tests.

## Evidence contract

Every SEV-0/1 and material SEV-2 record must preserve, where available and privacy-safe:

- incident/reference ID and correlation ID
- first/latest occurrence and status
- surface, operation, role, school/cohort scope
- release/deployment identity
- RPC/server operation category
- sanitized error category (never raw SQL/token/secret to end users)
- affected-user estimate and blast radius
- data-integrity and privacy impact flags
- containment action and actor
- recovery action and verification evidence
- recurrence/prevention evidence

Task 14 consumes the canonical telemetry/evidence contracts from Task 12; it must not create a competing analytics pipeline.

## Existing control audit

### Worker Engine

Current repository foundations already provide a fail-closed runtime plane:

- owner-authenticated runtime policy and runtime control RPCs
- runtime OFF forces autonomy/risk to zero and disables heartbeat/factory
- activation is denied when the global breaker is tripped
- activation requires explicit enabled global policy and active bounded authority
- installation asserts fail-closed state and zero active authority
- execution dossier uses task ID as canonical correlation identity
- forensic attention and telemetry-completeness contracts exist

Task 14 will reuse these controls rather than add a second Worker Engine stop mechanism.

### Global Stop interpretation

For pilot incident control, Global Stop is scoped to consequential autonomous Worker Engine operations. It must not be treated as a whole-site maintenance switch. Ordinary authentication and unrelated school journeys must remain available unless their own failure requires containment.

## Containment hierarchy

Use the smallest safe blast radius:

1. one asset/job/integration/write path
2. one module or capability
3. one cohort/school scope when architecture supports it
4. Worker Engine runtime/global breaker for autonomous consequences
5. whole-platform maintenance only when the shared dependency itself is unsafe

Never use direct production database editing as the normal containment interface.

## Recovery invariants

- Preserve canonical student identity; never blindly recreate, merge or delete users/students.
- Suspected identity corruption may require write containment until authoritative mapping is known.
- Cross-student/parent/school leakage is SEV-0.
- Academic records are never invented to fill missing attendance/homework/assessment/result evidence.
- Duplicate assessment/payment requests must be idempotent or reconciled from authoritative evidence.
- A deployment rollback is allowed only after application/database compatibility is proven.
- Prefer forward-safe DB repair when rollback could lose valid writes.
- M-Pesa initiation remains OFF unless separately commissioned; money-moved/application-failed incidents are reconciled from provider/callback/ledger evidence, never blind retries.

## Required isolated simulations

| ID | Scenario | Required proof |
|---|---|---|
| A | Auth/onboarding RPC failure | classified; safe error; no identity recreation; recovery path |
| B | Learning progress partial failure | no false completion; retry/reconcile safely |
| C | Repeated assessment submit | one authoritative outcome; duplicate safely denied/idempotent |
| D | Parent requests another learner | access denied; SEV-0 evidence path available; no leakage |
| E | Teacher requests unauthorized class | access denied; no cross-class evidence leakage |
| F | Consequential Worker action during Global Stop | denied; zero mutation; no lingering temporary authority |
| G | Migration candidate failure | disposable DB catches failure; production untouched |
| H | App/DB contract mismatch | release gate catches incompatibility before production |

## Runbook — SEV-0

1. Confirm from trustworthy evidence; establish correlation and blast radius.
2. Contain the narrowest unsafe access/action immediately. For Worker Engine consequences, trip/retain stop state and reduce runtime authority.
3. Preserve logs, deployment identity, affected object IDs and authorization evidence. Do not delete evidence.
4. Do **not** perform ambiguous identity merges, destructive cleanup, broad grant changes or speculative deployments.
5. Root-cause the authorization/identity/action boundary.
6. Repair in an isolated candidate; add negative tests and regression prevention.
7. Reconcile with current main; rerun privacy/RLS/identity/security gates.
8. Promote only after hold/release gates permit it.
9. Verify containment and absence of recurrence before controlled review closes the incident.

## Runbook — SEV-1

1. Reproduce or confirm from telemetry and establish affected journey/cohort.
2. Contain repeating writes or the failing subsystem if continued execution can worsen state.
3. Preserve correlation, release, RPC/server and data-integrity evidence.
4. Select recovery by compatibility: retry only idempotent operations; quarantine defective assets/jobs; use forward-safe DB repair where rollback is unsafe.
5. Implement and test in isolation.
6. Verify original reproduction, surrounding journey, data correctness and security.
7. Reconcile current main and release through normal gates.
8. Monitor recurrence before Resolved.

## Dependency register

| Dependency | Status | Task 14 impact | Gates to rerun after change |
|---|---|---|---|
| Task 12 telemetry/observability | upstream/shared foundation | canonical event/error/correlation contracts | telemetry + incident simulations + HQ evidence |
| Task 3 canonical student identity | upstream/shared foundation | identity incident recovery and authoritative verification | identity + academic-write simulations |
| Task 8 authorization/privacy | upstream/shared foundation | SEV-0 containment and negative tests | RLS/privacy + D/E simulations |
| Worker Engine shared foundation | upstream/shared foundation | Global Stop, authority expiry, breakers, forensic dossier | Worker governance + F simulation |
| M-Pesa commissioning | intentionally non-pilot dependency until enabled | payment recovery only when active | payment idempotency/reconciliation if commissioned |
| Integrated release control | upstream/shared foundation | candidate/known-good compatibility and promotion | build + migration + release gates |

## Certification ledger

- [x] canonical severity documented
- [x] lifecycle documented
- [x] evidence contract documented
- [x] containment hierarchy documented
- [x] SEV-0/SEV-1 executable runbooks established
- [x] Worker Engine existing runtime/forensic controls identified
- [ ] canonical Task 12 integration implemented/reconciled
- [ ] HQ incident surface implemented
- [ ] report-a-problem evidence integration implemented
- [ ] isolated simulations A–H green
- [ ] incident-control regression gate green
- [ ] current-main reconciliation after shared-foundation hold
- [ ] read-only production reinspection after reconciliation
- [ ] exact candidate security/build certification
- [ ] safe production verification
- [ ] zero unresolved P0/P1 incident-control defects

## Hold-gate rule

No merge, production Supabase mutation, migration application, RLS/grant change, data repair, Edge Function deployment, Worker Engine activation, payment activation, runtime-control mutation or intentional Vercel deployment is authorized from this branch while the shared-foundation hold remains active.
