# Worker Engine — L0 Freeze Addendum

**Date:** 2026-08-10  
**Status:** L0 RED / Worker Engine implementation BLOCKED  
**Authority:** Worker Engine Architecture Freeze v1

## Purpose

Record the production findings that must remain part of the Worker Engine implementation contract. This document is a decision record, not an implementation plan that authorizes new Worker Engine tables in production.

## Current production findings

- Production project: `yauqsxggtuxuykcbrtzf`
- Production contains a substantial existing `hq_workforce_*` implementation.
- Existing HQ workforce tables are RLS-enabled in production, including workers, roles, skills, worker skills, worker certifications, jobs, runs, lanes, assignments, security events, evidence, verification, and related governance tables.
- `teaching_occurrences` is also RLS-enabled.
- Repository migration history and the production migration ledger are not currently equivalent.
- A blank rebuild is therefore not yet a trustworthy reproduction of production.

## Freeze decisions added by this evidence

### L0-1 — No parallel Worker Engine

Do **not** introduce a second parallel workforce subsystem merely because the frozen contract uses canonical names such as `Worker`, `Blueprint`, `Capability`, `Budget`, `Context`, `Verification`, or `Audit Event`.

Before L1, the existing `hq_workforce_*` implementation must be mapped against the frozen contracts. Each existing table/function must be classified as one of:

1. canonical implementation candidate;
2. compatible supporting implementation;
3. migration target;
4. obsolete/duplicate; or
5. unresolved architectural conflict.

An unresolved conflict blocks L1.

### L0-2 — Production is evidence, not migration authority

Production schema inspection may establish what currently exists, but it does not authorize silently changing migration history. Existing production migration ledger entries must not be rewritten merely to make the repository appear clean.

### L0-3 — Reproducibility before expansion

The required sequence remains:

`foundation verification → migration reconciliation → TBL-011 verification → RPC hardening → blank rebuild green → Worker Engine implementation`

No Worker Engine production DDL is permitted before this sequence exits green.

### L0-4 — Security fields remain enforcement fields

`school_id` must remain a security dimension in the frozen Worker Engine contracts. Existing HQ workforce tables that carry school scope must be tested for consistency with this rule. Any table/function that treats school scope as descriptive metadata is non-compliant for Worker Engine use.

### L0-5 — Existing RLS is not proof of correct authorization

The fact that existing `hq_workforce_*` tables have RLS enabled is necessary but not sufficient. L0/L1 verification must also establish:

- correct policy predicates;
- correct grants;
- no anonymous bypass;
- no unintended `SECURITY DEFINER` exposure;
- no direct privileged write path that bypasses the boundary RPC model;
- correct school isolation; and
- live revocation enforcement where privileged worker calls are involved.

## Required L0 evidence package

The following artifacts are authoritative exit evidence:

1. Ordered production migration ledger.
2. Ordered repository migration inventory.
3. Collision/reconciliation register.
4. TBL-011 clean-rebuild definition and verifier output.
5. TBL-012 schema comparison/hash output.
6. Public RPC/function inventory with EXECUTE grants and security mode.
7. Existing `hq_workforce_*` → frozen Worker Engine contract mapping.
8. Blank rebuild result from the repository migration set.

## L0 exit test

L0 is GREEN only when all of the following are true:

- blank rebuild succeeds;
- migration reconciliation is documented and reproducible;
- TBL-011 verifier passes;
- TBL-012 schema verification passes;
- RPC inventory is clean against the freeze;
- no unresolved architecture question remains; and
- the existing HQ workforce implementation has been explicitly classified against the frozen Worker Engine contracts.

Until then, **L1 remains blocked**.

## Non-goals

This addendum does not:

- create Worker Engine tables;
- alter production permissions;
- rename existing HQ workforce tables;
- delete existing production objects;
- authorize autonomous worker execution;
- amend the frozen authority model.
