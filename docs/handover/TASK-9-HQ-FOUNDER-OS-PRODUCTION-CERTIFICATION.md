# Task 9 — HQ Founder OS Production Certification

## Canonical promotion line

- Repository: `eduworldkenya-sys/vibeschool`
- Base main SHA at final reconciliation start: `a8f3fc572934b00bfa8d565b940af169f00aef18`
- Branch: `task9/final-reconciliation-20260820`
- Canonical PR: `#333`
- Historical Founder OS PR: `#298` — superseded after canonical merge once unique value is represented.

## Scope

Task 9 owns the Founder/company operating system: deterministic company state, Attention, founder decisions, incidents/findings/work visibility, execution-integrity evidence, Worker runtime/readiness visibility, owner emergency stop, business/revenue integrity and explainable school-success evidence. Task 9 does not activate Worker runtime, increase autonomy/risk, release Global Stop, initiate payments, publish content or grant execution authority.

## Company-state contract

Canonical precedence is `INCIDENT > DEGRADED > ATTENTION > LIVE`. State provenance is based on incidents, findings, founder decisions, overdue high-priority work, execution verification gaps, breakers, revenue/reconciliation exceptions, content-health signals and certification availability. Historical execution gaps are shown as gaps; no missing intent or verification evidence is fabricated.

## Production migration parity

The Founder OS SQL is already commissioned in production and repository reconciliation uses the exact production migration ledger versions:

- `20260819101701_hq_founder_os_control_plane.sql`
- `20260819101945_hq_worker_runtime_readiness.sql`
- `20260819102035_hq_worker_runtime_readiness_schema_fix.sql`
- `20260819102450_worker_engine_r13x_certification_fail_closed.sql`
- `20260819102816_hq_worker_emergency_stop.sql`
- `20260819103034_hq_revenue_operations_snapshot.sql`
- `20260819103207_hq_founder_os_business_health.sql`
- `20260819103321_hq_school_success_snapshot.sql`
- `20260819113112_hq_worker_emergency_stop_security_contract.sql`

These files are repository parity for already-recorded production migrations and must not be re-versioned or re-applied under new migration versions.

## Security evidence

Production readback verified the canonical Founder RPCs as `SECURITY DEFINER` with pinned `search_path=public, pg_temp`. `anon` execute is denied, `authenticated` is the transport role, `service_role` execute is denied, and each privileged Founder-facing RPC performs server-side owner assertion. The internal `hq_founder_os_snapshot_core(integer)` is not directly executable by ordinary authenticated callers.

Owner emergency stop remains a one-way safety action only: it can disable runtime/shadow/factory/heartbeat, force autonomy/risk to zero and establish Global Stop. It contains no activation path.

## Production preflight

Latest read-only production preflight during reconciliation:

- Worker runtime: OFF
- Autonomy: L0
- Maximum risk: R0
- Global Stop: ACTIVE
- Shadow stopped: true
- Enabled global runtime policies: 0
- Active capability authority grants: 0
- Tripped global breakers: 0
- Activation request readiness: BLOCKED
- Open incidents: 0
- Open findings: 1
- Open work items observed: 56

No production Worker activation, Global Stop release, capability grant activation, payment initiation, publication or destructive data mutation was performed during Task 9 reconciliation.

## Certification gates

The exact final candidate must pass fresh PR-head evidence for:

- Task 9 Founder OS Final
- HQ Control Room Certification
- Supabase Migration Security Contract
- TBL-011 Isolated Clean Rebuild
- Task 2 Database Reconstruction Integrity
- TBL-012 repository parity/extractor
- Worker Engine Promotion Planner regression
- Task 8 Authorization Contract
- TypeScript and Production Build Gate
- CI Production Build Contract
- Engineering Control Plane / Integration Gate where applicable

Historical green evidence from PR #298 is not promotion evidence.

## Post-merge verification contract

After protected merge, verify canonical main contains the Task-9 files, record the actual merge SHA in PR #333's final certification record, repeat production runtime/readiness and privileged-RPC security readback, verify production remains OFF/L0/R0 with Global Stop active unless separately authorized, and close PR #298 as superseded. Overlapping future HQ capabilities are retained only when they remain independent and are not represented by Task 9.
