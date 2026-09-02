---
name: vibeschool-engineering-os
description: Mandatory engineering protocol for VibeSchool missions. Use for implementation, debugging, refactoring, database work, PR convergence, certification, merge, deployment, or production verification.
---

# VibeSchool Engineering OS

## Prime directive
Facts before action. Never infer repository, database, deployment, or production truth from prompts, screenshots, old handovers, prior assistant claims, expected architecture, or naming conventions.

## Mission contract
Every mission has two inputs: MISSION (what outcome is wanted) and GOAL (measurable completion condition). The protocol below defines how the work is done.

## Required state machine
Never collapse these states or call work done early:
DISCOVERED -> DESIGNED -> IMPLEMENTED -> VERIFIED -> RECONCILED -> CERTIFIED -> MERGED -> PRODUCTION_VERIFIED.
A claim of DONE is permitted only at PRODUCTION_VERIFIED when production is in scope. If merge/deployment is intentionally out of scope, report the exact highest proven state.

## 1. Current truth
Before modifying code:
- resolve exact current main SHA;
- inspect relevant current-main code and contracts;
- inspect open/recent PRs for overlapping files, migrations, routes, contracts, or architecture;
- inspect existing tests and CI gates;
- for database-dependent work, inspect migrations and actual target Supabase truth before assuming tables, columns, functions, grants, RLS, or data shape;
- for production-dependent work, inspect actual deployment/runtime evidence.
Record contradictions instead of silently choosing an assumption.

## 2. Concurrency safety
- Work from exact current main in an isolated branch/worktree.
- Do not modify, close, supersede, merge, or rewrite another active lane merely because it overlaps.
- Detect semantic overlap, not only file overlap.
- Preserve newer main behavior when reconciling stale work.
- Never force-update shared branches.
- Re-check main movement immediately before certification and merge.

## 3. Root-cause debugging
For defects: reproduce -> collect evidence -> trace contract/data/control flow -> identify root cause -> design smallest durable repair -> add regression proof -> implement. Do not patch symptoms when the cause is unresolved. Failed hypotheses must be discarded explicitly.

## 4. Implementation quality
- Reuse canonical architecture before creating new services, tables, RPCs, routes, state stores, or abstractions.
- Prefer strong typing and explicit contracts; avoid `any`, silent coercion, duplicated authority, hidden fallback, and catch-and-ignore behavior.
- Fail closed on authorization, identity, curriculum authority, publication authority, payments, and consequential worker actions.
- Preserve backward compatibility unless the mission explicitly authorizes a migration/break.
- Keep changes bounded to the mission; separate unrelated repairs unless they block correctness or certification.
- Comments explain invariants and non-obvious reasons, not restate code.

## 5. Supabase/Postgres safety
When relevant:
- establish schema and migration-ledger truth;
- verify RLS, grants, SECURITY DEFINER/INVOKER, search_path, tenant/school/user binding, RPC authorization, idempotency, and migration reversibility/forward repair;
- test positive and negative authorization paths;
- never expose service-role authority to the browser;
- never weaken RLS merely to make a feature work;
- reconcile repository migrations with production-applied versions before certification.

## 6. Test and adversarial review
Verification must match risk. Consider typecheck, lint, build, unit, contract, integration, migration reconstruction, authorization/RLS, concurrency/idempotency, accessibility/mobile, and user-journey tests as applicable.
After implementation, perform a separate adversarial review asking:
- what assumption is still unproven?
- what existing behavior could regress?
- what happens with empty, duplicate, stale, unauthorized, cross-tenant, slow, failed, or concurrent inputs?
- did we create a second source of truth?
- can the UI claim success when persistence failed?
Repair material findings before certification.

## 7. Reconciliation
Before certification:
- fetch current main truth again;
- compare candidate with current main and active overlapping PRs;
- reconcile intentionally, preserving newer canonical work;
- rerun affected verification after reconciliation.
A candidate built on stale main is not certified merely because its earlier tests passed.

## 8. Certification
Certification is evidence tied to one exact candidate head SHA. Required relevant checks must be green on that head. Record residual risks and external/owner-only blockers truthfully. Never convert unavailable evidence into a pass.

## 9. Merge safety
Merge only when explicitly authorized and when the exact certified head is still the PR head. Use an expected-head guard where supported. Do not bypass branch protection to manufacture completion. If main moved in a way that invalidates certification, reconcile and recertify.

## 10. Production verification
A successful merge or deployment is not production certification. When production is in scope, verify the deployed SHA/version and the affected real contract/journey, including database/runtime state where relevant. Do not fabricate external-provider success.

## VibeSchool invariant guardrails
- Teacher, learner, parent, school-admin, HQ, Worker/Cyborg, curriculum/content, publication, and payment authority boundaries remain explicit.
- Exact curriculum identity and verified authority must not be replaced by fuzzy/title/embedding matching in authoritative paths.
- Worker/Cyborg runtime, scheduler, publishing, payments, Global Stop, or consequential authority must not change incidentally.
- Public convenience never justifies weakening private authorization.
- Production data mutations require mission relevance, authorization, bounded scope, and verification.

## Completion report
Report facts, not effort. Include: exact starting main SHA; candidate/PR/head SHA; highest proven state; checks/evidence; merge/deployment status; production verification; unresolved blockers/residual risks. Never say `finished`, `certified`, `merged`, or `production verified` unless that exact state is proven.
