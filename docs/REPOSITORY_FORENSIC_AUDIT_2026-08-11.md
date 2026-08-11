# VibeSchool Repository Forensic Audit — 2026-08-11

**Repository:** `eduworldkenya-sys/vibeschool`
**Canonical production branch:** `main`
**Audit branch:** `audit/repository-branch-forensics-20260811`
**Audit mode:** read-only forensic analysis; no branch deletion, merge, force-update, or history rewrite authorized by this artifact.
**Audit objective:** establish evidence-backed branch lineage, production relevance, architectural ownership, and cleanup disposition so future sessions can continue without relying on chat history.

## 1. Control state

This audit supersedes informal branch-name interpretation. A branch is not disposable merely because it is old, similarly named, behind `main`, or points to a commit also referenced elsewhere.

Deletion requires verified evidence for PR state, protection/deployment/workflow dependencies, unique commits, architectural significance, and preservation requirements.

## 2. Repository inventory

The GitHub branch inventory currently contains **114 visible branches** across the returned pages. The inventory includes active delivery, architecture, recovery, security, backup, temporary, documentation, student, curriculum, VibeTwin, content, HQ, and historical work.

The inventory observed on the first page includes:

- `agent/*`
- `backup/*`
- `ce-*`
- `content/*`
- `docs/*`
- `engine/*`
- `exq-*`
- `feat/*`
- `feature/*`
- `fix/*`
- `hq-*`
- `hw-*`
- `main`
- `ops/*`
- `read-*`
- `refinement/*`
- `security/*`
- `spec/*`
- `student-*`
- `tmp/*`
- `vercel/*`
- `vibelearn-*`
- `vibetextbook-*`
- `vision/*`

The second inventory page contains the remaining temporary/workflow branches, including `tmp/hq-worker-*`, `vercel/react-server-components-cve-vu-up1pn3`, `vibelearn-form4-exam-readiness`, `vibelearn-student-workstation`, `vibetextbook-form4-biology-landmark`, and `vision/future-vibeschool`.

## 3. Verified main baseline

`origin/main` currently resolves to:

`da22282b7a7be1c282aeeb335276df40515cf2c5`

Commit message:

`docs: establish repository branch archaeology and cleanup controls`

This commit already establishes the repository's archaeology/cleanup control framework. The current forensic pass is therefore an evidence expansion of that control rather than a new cleanup doctrine.

## 4. Verified branch comparisons

Comparisons below are against `main` at `da22282b7a7be1c282aeeb335276df40515cf2c5`.

| Branch | Graph relation | Ahead | Behind | Initial disposition | Evidence |
|---|---:|---:|---:|---|---|
| `agent/adaptive-tutor-ui-98` | behind | 0 | 238 | **RETENTION REVIEW** | No unique commits ahead of main, but very old divergence; PR/refs/dependency checks still required before deletion. |
| `agent/hq-workroom-production` | diverged | 2 | 7 | **ACTIVE/ARCHITECTURAL** | Contains HQ Workroom production pages, HQ shell/operating changes, and production migrations. |
| `agent/supabase-foundation-recovery` | diverged | 3 | 9 | **CRITICAL PRESERVATION** | Contains foundation scope evidence, migration ledger/reconciliation artifacts, and production recovery evidence. |
| `agent/worker-engine-freeze-l0` | diverged | 22 | 2 | **CRITICAL PRESERVATION** | Contains L0 recovery evidence, architecture freeze, structural diff workflow, provenance tooling, and decision playbook. |
| `refinement/worker-engine-architecture-freeze` | diverged | 2 | 2 | **ARCHITECTURAL PRESERVATION** | Contains Worker Engine architecture freeze and canonical trace documents. |
| `fix/tbl012-m-repo-extractor` | diverged | 8 | 2 | **ACTIVE FORENSIC TOOLING** | Contains the TBL012 M(repo) extractor workflow and extraction script. |

### Important graph finding

`agent/hq-workroom-production`, `agent/supabase-foundation-recovery`, `agent/worker-engine-freeze-l0`, `refinement/worker-engine-architecture-freeze`, and `fix/tbl012-m-repo-extractor` are **not** safely classifiable as stale simply from branch age or naming. They carry unique commits relative to current `main` and in several cases contain current production/recovery evidence.

## 5. Worker Engine/L0 preservation finding

The L0 line is materially independent from current `main`:

- `agent/worker-engine-freeze-l0`: **22 unique commits ahead, 2 behind**.
- `refinement/worker-engine-architecture-freeze`: **2 unique commits ahead, 2 behind**.
- `fix/tbl012-m-repo-extractor`: **8 unique commits ahead, 2 behind**.

These branches must not be bulk-deleted or merged merely to reduce branch count. Their relationship must be reconciled at the architecture level first.

The L0 branch contains, among other artifacts:

- `docs/WORKER_ENGINE_ARCHITECTURE_FREEZE_V1.md`
- `docs/L0_DECISION_PLAYBOOK.md`
- `docs/L0_RECOVERY_EVIDENCE_2026-08-10.md`
- `docs/L0_RECOVERY_UPDATE_LOG.md`
- `scripts/l0/catalog-foundation.sql`
- `scripts/l0/provenance-sweep-preledger.sh`
- `.github/workflows/l0-structural-schema-diff.yml`

The TBL012 branch contains:

- `.github/workflows/tbl012-m-repo-extractor.yml`
- `scripts/l0/extract-m-repo.js`
- a `package.json` change supporting the extractor.

## 6. HQ Workroom finding

`agent/hq-workroom-production` is not a duplicate pointer to `main`.

It has two unique commits relative to `main` and contains production HQ Workroom implementation, including:

- `app/hq/workroom/[id]/page.tsx`
- `app/hq/workroom/page.tsx`
- `components/hq/HQShell.tsx`
- `lib/hq/operating.ts`
- `supabase/migrations/20260810034856_hq_workroom_production.sql`
- `supabase/migrations/20260810143000_hq_workroom_foreign_key_indexes.sql`

Disposition: **preserve pending canonical HQ integration decision**.

## 7. Supabase foundation recovery finding

`agent/supabase-foundation-recovery` is a recovery/evidence branch, not an ordinary stale feature branch.

Its unique commits contain:

- `docs/L0_EVIDENCE/FOUNDATION_SCOPE_2026-08-11.md`
- `scripts/l0/derive-foundation-scope.sql`
- `supabase/reconciliation/tbl013_live_ledger_audit_summary_20260810.json`
- `supabase/reconciliation/tbl013_live_migration_ledger_20260810.txt`
- `supabase/reconciliation/tbl013_reconciliation_plan_20260810.md`

Disposition: **critical preservation until production/rebuild reconciliation is certified**.

## 8. Old branch warning

`agent/adaptive-tutor-ui-98` is already **238 commits behind `main` and has zero commits ahead** according to the GitHub compare graph.

This is a strong deletion candidate *from the Git graph alone*, but deletion is deliberately not yet authorized because the complete forensic gate still requires PR state, branch protection, workflow/deployment references, and any required historical preservation check.

This is the model for the entire audit: graph evidence identifies candidates; it does not silently authorize destruction.

## 9. Architecture families requiring full reconciliation

The branch population shows distinct families that must be analysed independently:

1. HQ operating system / workroom / workforce / nervous system / hardening
2. Worker Engine / L0 recovery / architecture freeze
3. VibeTwin P1–P12 and related learning OS/tutor branches
4. Content Engine / Content Studio / publishing factory
5. Student OS / learner workstation / student home / student twin
6. Supabase foundation / migration history / grants / security
7. Classroom learning loop / assessment / homework authority
8. Form 4 biology / textbook / living edition systems
9. Security / identity / authentication / RLS / explicit grants
10. Temporary and backup branches

No family should be collapsed solely by branch naming.

## 10. Cleanup decision states

Use these states throughout the remainder of the audit:

- `KEEP_ACTIVE` — active implementation work.
- `KEEP_CRITICAL` — production/recovery/security evidence that must remain available.
- `ARCHITECTURAL_REVIEW` — unique implementation or design requiring canonical decision.
- `HISTORICAL_PRESERVE` — no longer active, but historical state is valuable; tag before branch deletion.
- `DELETE_CANDIDATE` — graph and evidence support removal, but final deletion gate remains pending.
- `DELETE_AUTHORIZED` — every deletion gate is verified and recorded.
- `UNKNOWN` — evidence incomplete; retain branch.

## 11. Hard deletion gate

A branch cannot reach `DELETE_AUTHORIZED` unless all are verified:

- [ ] no open PR
- [ ] no required closed-PR preservation dependency
- [ ] not protected
- [ ] no deployment dependency
- [ ] no workflow/automation dependency
- [ ] no unique unreconciled commit
- [ ] no unresolved architecture role
- [ ] required historical SHA tagged/preserved
- [ ] deletion reason recorded
- [ ] post-deletion verification plan recorded

## 12. Major decision boundary

The following are **major architectural decisions** and must not be silently made during cleanup:

- choosing one competing HQ implementation as canonical;
- choosing one Worker Engine implementation as canonical;
- collapsing VibeTwin P1–P12 into a single historical lineage;
- declaring a migration/evidence branch obsolete before production reconciliation;
- deleting security/Supabase recovery history;
- rewriting or force-moving branch history.

If any of these becomes necessary, stop and request owner approval.

## 13. Next forensic passes

The remaining audit passes are:

### Pass A — complete branch graph
Compare every remaining branch against `main` and record ahead/behind/merge-base evidence.

### Pass B — PR state
Resolve branch-to-PR relationships and open/closed/merged state.

### Pass C — repository references
Search workflows, deployment configuration, documentation, scripts, and automation for branch references.

### Pass D — unique commit/architecture analysis
For every candidate, inspect unique commits and determine whether they are implementation, evidence, backup, experiment, or obsolete work.

### Pass E — preservation
Create immutable milestone tags for historically significant states before any deletion recommendation.

### Pass F — controlled cleanup
Only branches that reach `DELETE_AUTHORIZED` may be removed, in small batches, with verification after each batch.

## 14. Continuation contract for future ChatGPT sessions

A future session must read this document before performing repository cleanup.

The future session must:

1. treat `main` at its current verified SHA as production authority unless repository evidence proves it changed;
2. continue from the latest audit state rather than restarting branch interpretation;
3. preserve `KEEP_CRITICAL` and `ARCHITECTURAL_REVIEW` branches;
4. never infer deletion safety from branch names alone;
5. update this artifact with new evidence;
6. stop for owner approval before major architectural or destructive decisions; and
7. report completion only after the full branch/PR/dependency/preservation audit is complete.

## 15. Current audit status

**NOT COMPLETE.**

The control framework is established and the first critical graph comparisons have been verified. No destructive cleanup has been performed.

The next execution step is the remaining branch-by-branch graph audit, followed by PR/dependency and preservation checks.
