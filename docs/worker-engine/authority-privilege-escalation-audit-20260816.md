# Worker Engine Authority & Privilege Escalation Audit

Date: 2026-08-16
Scope: GitHub PR #166 + live production Supabase, read-only production inspection.

## Mission

Prove that no worker, scheduler, service adapter, Edge Function, or stale legacy path can create, widen, restore, or self-approve its own authority. Authority must remain external to execution and fail closed.

## Production findings

### Positive controls already present

- `hq_workforce_issue_certification(...)` is not executable by anon, authenticated, or service_role.
- Autonomous heartbeat/factory functions are not executable by anon, authenticated, or service_role.
- Runtime task authorization and shadow tool execution are likewise not directly executable by those roles.
- Certification rows have a mutation guard: identity/evidence fields are immutable, DELETE is forbidden, and status may only move active -> revoked/expired.
- Capability grants validate against an existing creation contract and reject capabilities outside the contract authority ceiling or mismatched scope type.

### P0 authority-plane weakness

Production grants `service_role` direct INSERT/UPDATE/DELETE privileges on core authority-bearing tables including:

- `hq_workforce_capability_grants`
- `hq_workforce_certifications`
- `hq_workforce_creation_contracts`
- `hq_workforce_workers`

and INSERT/UPDATE on `hq_workforce_runtime_policies`.

These tables have RLS enabled but no policies. `service_role` is the infrastructure bypass role, so RLS is not an authority boundary for service-role clients.

Triggers provide useful semantic validation for some objects, but database table grants still make service-role possession equivalent to broad authority-plane mutation capability. That violates the production-readiness invariant that infrastructure privilege must not equal Worker Engine authority.

### Important distinction

`hq_workforce_runtime_self_certify()` is badly named but does not issue worker authority. It writes health/certification assertions into `hq_runtime_certifications`. Treat it as a legacy operational certification recorder, not a worker self-grant path. Rename/retire later to remove ambiguity.

`hq_workforce_revoke_certification(...)` is service-role executable. Revocation is safety-decreasing only in availability, not privilege-expanding, but it remains a privileged control-plane action and requires operator/evidence lineage.

## Root cause

Earlier Worker Engine generations used `service_role` as a trusted backend/operator boundary. R1.4 introduces a stronger model where authority is a first-class, scoped, evidenced object. The production privilege model has not yet been reconciled to that architecture.

The defect is therefore architectural drift, not merely missing REVOKE statements.

## Required solution

Do not patch individual functions. Establish a canonical authority mutation plane:

1. Direct table DML on authority-bearing tables is denied to application/service adapters by default.
2. Authority issuance/widening occurs only through narrowly scoped SECURITY DEFINER gateways with explicit actor, reason, evidence, scope, expiry and lineage.
3. Workers and execution gateways can consume authority but cannot issue or widen it.
4. Revocation/suspension may be separately exposed as fail-safe operations but must remain append-only evidenced actions.
5. Runtime policy and engine-state changes require the same governed operator path.
6. Edge Functions using service_role are never trusted merely because they possess the key.
7. Clean rebuild and production reconciliation tests assert grants, trigger guards and function EXECUTE privileges exactly.

## Activation blocker

R1.4 production activation remains blocked until service-role direct DML over the authority plane is removed or cryptographically/transactionally constrained behind the canonical authority gateways and exact-head certification proves no privilege-escalation route remains.

## Next engineering contract

Design an additive forward migration for the isolated PR branch that narrows authority-plane table grants and introduces/locks canonical mutation gateways without modifying production. Then test clean rebuild compatibility and legacy callers before any deployment decision.