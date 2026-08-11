# Branch Forensics — Shell Observation

**Date:** 2026-08-11  
**Repository:** `eduworldkenya-sys/vibeschool`  
**Audit branch:** `audit/repository-branch-forensics-20260811`  
**Purpose:** Preserve the first live-shell observation before interpreting or deleting repository refs.

## 1. Execution result

The operator ran:

```bash
git fetch --all --prune
git merge-base --is-ancestor ...
git rev-list ...
git log --all --full-history ...
```

`git fetch --all --prune` executed successfully. The subsequent commands containing literal `...` were not valid Git invocations and produced the expected `git merge-base` usage output. Therefore **no ancestry conclusion is inferred from those malformed invocations**.

## 2. Fetch result

The fetch discovered a substantial remote branch population, including active-looking work across:

- HQ / workroom / workforce
- Worker Engine / L0 recovery
- VibeTwin
- Content Engine / publishing
- Student OS / learner experiences
- Security / identity
- Supabase foundation / migration repair
- architecture/specification work
- temporary and backup branches
- repository archaeology/governance

The fetched refs include, among others:

```text
origin/main
audit/repository-branch-forensics-20260811
docs/repo-branch-archaeology-governance
agent/worker-engine-freeze-l0
agent/supabase-foundation-recovery
fix/tbl012-m-repo-extractor
fix/supabase-release-foundation-20260810
fix/issue-63-reproducible-baseline-20260810
feat/hq-autonomous-workforce-os
feat/hq-operating-system
feat/hq-workforce-final-hardening-20260809
feat/hq-product-nervous-system-20260809
engine/closed-learning-publishing-loop
engine/top-tier-content-intelligence-v2
feature/hq-curriculum-intelligence
feature/reusable-interactive-lab-library
feature/reusable-interactive-lab-library-2
security/hq-defense-in-depth
security/supabase-explicit-grants-20260810
security/supabase-explicit-grants-followup-20260810
spec/autonomous-engine-system-v1
```

This confirms branch proliferation is real in the current remote ref set. It does **not** establish that the branches are obsolete.

## 3. Current `main` authority

The observed remote tip is:

```text
origin/main = da22282b7a7be1c282aeeb335276df40515cf2c5
```

The corresponding commit message is:

```text
docs: establish repository branch archaeology and cleanup controls
```

This is consistent with the repository's existing cleanup-control document and establishes `main` as the current production/reference authority for this audit unless later evidence proves otherwise.

## 4. Significant evidence observed in history

Recent history contains a dense sequence of L0 foundation, migration, security, Worker Engine, HQ, and classroom-learning changes. Examples observed in the shell output include:

```text
feat(tbl012): add M(repo) foundation mutation extractor
docs(l0): record corrected foundation scope and mutation evidence
chore(l0): add read-only foundation scope evidence instrument
L0: record provenance sweep and current catalog evidence
docs(L0): record dependency closure discovery
docs(L0): record foundation dependency closure evidence
docs: record L0 foundation recovery evidence
docs: record fresh L0 production ledger snapshot
L0: use linked migra diff only through Supabase CLI
fix(db): recover VibeLearn catalogue baseline
fix: restore Data API product gate execute permissions
fix(auth): harden role lookup fallback
fix(tbl-011): restore shared updated-at trigger helper
security: make policyless HQ tables service-only
Build the classroom learning loop
Build HQ workroom production foundation (#64)
Isolate HQ auth and complete password recovery (#59)
```

These commits demonstrate that many branches are associated with active architectural recovery rather than simple stale feature work. They must therefore remain in the **investigation** state until reachability and PR evidence is calculated.

## 5. Backup / duplicate-looking refs observed

The history also exposed backup refs such as:

```text
backup-vercel-fix-20260805-155502
backup-before-vercel-rebase-20260805-154407
backup-before-tos005-reset-20260803-214031
backup/local-main-before-ce-type-merge-20260803
```

Several backup refs visibly point at commits also referenced by other refs. This is a strong candidate for later cleanup, but **no deletion decision is made here**. Same-SHA duplication must first be checked against PR, protection, workflow/deployment, and preservation requirements.

## 6. Important correction to the audit procedure

The literal placeholders used in the operator command must not be copied into future audit execution.

The next shell-level pass must substitute real refs/SHAs, for example:

```bash
git merge-base --is-ancestor <branch-tip> origin/main

git rev-list --count origin/main..<branch-tip>

git rev-list --left-right --count origin/main...<branch-tip>

git log --all --full-history -- <path>
```

For branch-wide automation, the audit should enumerate each branch tip first and then execute these checks programmatically.

## 7. Evidence classification

| Observation | Status | Interpretation |
|---|---|---|
| `git fetch --all --prune` succeeded | VERIFIED | Remote refs are available for local graph analysis |
| Large branch population | VERIFIED | Branch proliferation is present |
| Many recent architecture/recovery branches | VERIFIED | Cleanup requires architecture-aware classification |
| Some backup refs overlap visible history | OBSERVED | Candidate for later duplicate analysis |
| Branch is safe to delete | NOT ESTABLISHED | No deletion gate has yet been satisfied |
| Ancestry relationship for every branch | PENDING | Requires real SHA/ref comparisons |
| PR state for every branch | PENDING | Requires GitHub PR inventory |
| Deployment/workflow dependency | PENDING | Requires repository reference scan |
| Canonical implementation per subsystem | PENDING | Requires architecture mapping |

## 8. Control decision

**No destructive repository action is authorized by this evidence.**

The correct next step is a read-only forensic inventory that produces, for every branch:

1. tip SHA;
2. relationship to `origin/main`;
3. unique commit count;
4. PR state;
5. protection/dependency signals;
6. architectural family; and
7. provisional disposition.

Only after that dataset is complete should any branch move from `INVESTIGATE` to `SHOULD_DELETE`.

---

## Audit principle

> **Evidence first. Classification second. Preservation third. Deletion last.**
