# L0 Evidence-to-Decision Playbook

**Status:** Frozen recovery procedure  
**Scope:** L0.1 structural schema recovery only  
**Production mutation:** Prohibited  
**Worker Engine coding:** Blocked until L0 exit criteria are green

## 1. Purpose

This document defines the deterministic procedure for interpreting the L0 structural-schema evidence and selecting the L0.2 reconciliation strategy. It is a recovery process, not product architecture. It does not authorize production changes.

The artifact is evidence. The artifact determines the decision; migration-file counts do not.

## 2. Artifact Trust Gate

Do not interpret the Migra output until all four conditions below are satisfied.

### Gate 1 — Migra evidence exists

- `production-vs-rebuild-migra.sql` exists and is non-empty; **or**
- the file is explicitly empty and Migra exit code is `0`.

If neither is true: **FAIL**. Do not classify objects.

### Gate 2 — Exit codes are recorded

The evidence directory must contain recorded exit status for:

- local rebuild/reset;
- local schema dump;
- production schema dump;
- structural diff/Migra.

Missing status is a **FAIL**, not an assumption of success.

### Gate 3 — Object inventories are present

Both local and production inventories must exist. Production inventory is expected to match the known baseline truth:

- **413 tables**
- **871 functions**
- **636 policies**

A mismatch is a **FAIL / investigation required**. Do not reinterpret the known truth to make the run pass.

### Gate 4 — Failure position is expected

The local rebuild log must show the known failure at:

`20260521083057_report_schedules.sql`

and must show **no unexpected earlier migration failure**.

If an earlier failure exists, the diagnosis changes and the run is **FAIL / restart or repair the instrument**.

## 3. Trust-Gate Verdict

Record one verdict per gate:

| Gate | Pass condition | Verdict |
|---|---|---|
| G1 | Migra output valid | PASS / FAIL |
| G2 | Required exit codes recorded | PASS / FAIL |
| G3 | Inventories present; production counts match 413/871/636 | PASS / FAIL |
| G4 | Expected rebuild crash and nothing earlier | PASS / FAIL |

**Interpretation is authorized only when G1–G4 are PASS.**

## 4. Deterministic Object Classification

Classify each relevant production-vs-rebuild difference into exactly one primary bucket before proposing remediation.

### Bucket 1 — Missing Foundation

**Test:**

The object exists in production **and** is required/referenced by a repository migration that runs before the object is created.

**Response:**

- reconstruct only the ordered pre-ledger foundation required for the migration chain to execute;
- preserve dependency order;
- do not invent unrelated schema;
- do not delete production objects;
- record the exact migration(s) that establish the dependency.

The foundation list is the primary L0.1 deliverable.

### Bucket 2 — `hq_*` Workforce Drift

**Test:**

The object is `hq_`-named or is referenced only by `hq_*` workforce functions/system.

**Response:**

- inventory only;
- record table/function relationships;
- record RLS, grants, and school-scope status;
- do not modify or delete as part of L0.1;
- map to the frozen Canonical Contracts during L0.3.

The existing HQ workforce system is treated as proto-Worker Engine infrastructure, not as permission to create a parallel engine.

### Bucket 3 — Security/RLS Drift

**Test:**

The difference concerns RLS policies, grants, role privileges, or `SECURITY DEFINER` function definitions/authorization behavior.

**Response:**

Classify each finding as:

1. **Intentional public gate** — port the intended behavior into repository-controlled migrations after verification; or
2. **Drift/weakness** — fix in the repository and deploy only through the governed CI/CD path.

Never repair production directly during L0.

Particular attention is required for:

- anonymous execution;
- `SECURITY DEFINER` functions without explicit authorization checks;
- RLS disabled or incomplete on security-sensitive tables;
- grants that bypass intended policy gates;
- cross-school access paths;
- runtime `service_role` usage.

### Bucket 4 — Orphans/Deadwood

**Test:**

The production object has no reference from repository code, repository views/functions, or the HQ workforce system.

**Response:**

- quarantine on a deadwood list;
- do not drop it;
- do not baseline-delete it merely because it appears unused;
- require a separate governed retirement decision before any DROP migration.

## 5. Evidence Precedence

Use evidence in this order:

1. Production structural inventory;
2. Local rebuild structural inventory;
3. Rebuild log and exact failure position;
4. Migra structural diff;
5. Repository migration dependency/reference analysis;
6. Migration-file counts only as historical context.

Migration counts such as “production has 552 and repo has ~350” are **not** sufficient evidence for a baseline decision.

## 6. Baseline vs Replay Decision

Do not choose the reconciliation model until the structural evidence is classified.

### Outcome A — Compressed Equivalent

Choose **A** only when, after reconstructing the verified missing foundation, the structural diff collapses to near-empty and the remaining differences are explainable as history compression, equivalent definitions, or other governed non-semantic differences.

**Conclusion:** repository history is a valid compressed equivalent of production.

**Action:**

- reconstruct the missing foundation;
- retain the repository history;
- do not rewrite the production migration ledger;
- defer any production-ledger alignment to a governed synthetic marker/strategy requiring explicit approval.

### Outcome B — Real Object Gap

Choose **B** only when the structural diff remains materially large after verified foundation reconstruction and the missing objects have no valid repository history.

**Conclusion:** production contains genuine schema state with no corresponding repository history.

**Action:**

- establish a governed baseline snapshot at a documented cutoff;
- replay verified repo-only migrations on top where appropriate;
- size the baseline/replay strategy by dependency entanglement;
- preserve the production migration ledger as immutable evidence.

### Decision Rule

**The artifact chooses A or B. Theory, migration-file counts, or architectural preference do not.**

## 7. Required L0.1 Completion Report

When the run completes, report exactly:

1. **Trust-gate verdict:** G1–G4 PASS/FAIL, with the evidence path/line supporting each.
2. **Object counts per bucket:** Foundation / HQ workforce / Security-RLS / Orphans.
3. **Bucket-1 foundation list:** exact object names, dependency/reference, and first migration requiring each object.
4. **One reconciliation recommendation:** Outcome A or Outcome B, with the specific evidence that supports it.
5. **Unresolved questions:** only questions that prevent a deterministic L0.2 decision.

## 8. Absolute L0 Safety Rules

- No production schema writes.
- No production policy edits.
- No production object deletion.
- No Worker Engine tables or higher-level Worker Engine modules.
- No autonomous migration execution against production.
- No baseline file is authored from assumptions before the artifact is trusted and classified.
- AI may summarize, classify, and draft; governed human/CI approval remains required for infrastructure changes.

## 9. L0 Exit Criteria

L0.1 is closed only when the artifact passes the trust gate and the four-bucket classification is complete.

L0.2 may begin only after the A/B reconciliation decision is recorded with evidence.

Worker Engine implementation remains blocked until the full L0 recovery exit criteria are green.
