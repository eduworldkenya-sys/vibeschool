# VibeSchool Repository Forensic Audit — 2026-08-11

**Repository:** `eduworldkenya-sys/vibeschool`
**Canonical production branch:** `main`
**Audit branch:** `audit/repository-branch-forensics-20260811`
**Audit mode:** read-only forensic analysis; no branch deletion, merge, force-update, or history rewrite authorized by this artifact.

## Executive status

**Audit in progress. Destructive cleanup remains frozen.**

The repository currently exposes **114 branches**. Initial graph analysis has already identified multiple branches carrying unique, current production, security, or L0 recovery evidence. Several apparently old branches have zero commits ahead of `main`, making them deletion candidates, but no deletion gate has yet been fully satisfied.

## 1. Verified main baseline

`origin/main` resolves to:

`da22282b7a7be1c282aeeb335276df40515cf2c5`

Commit: `docs: establish repository branch archaeology and cleanup controls`

## 2. Forensic rules

1. Branch names are signals, not evidence.
2. `ahead_by=0` identifies a graph-level deletion candidate, not automatic deletion authorization.
3. Unique commits must be inspected before consolidation.
4. Production, security, Supabase, L0, and architecture evidence is preserved until explicitly reconciled.
5. No force-push or history rewrite during archaeology.
6. Unknown evidence means retain.
7. Major architecture choices require owner approval.

## 3. Verified branch graph findings

| Branch | Relation to main | Ahead | Behind | Disposition |
|---|---:|---:|---:|---|
| `agent/adaptive-tutor-ui-98` | behind | 0 | 238 | `DELETE_CANDIDATE` pending PR/dependency checks |
| `agent/hq-workroom-production` | diverged | 2 | 7 | `KEEP_CRITICAL` / HQ architecture review |
| `agent/supabase-foundation-recovery` | diverged | 3 | 9 | `KEEP_CRITICAL` |
| `agent/worker-engine-freeze-l0` | diverged | 22 | 2 | `KEEP_CRITICAL` |
| `refinement/worker-engine-architecture-freeze` | diverged | 2 | 2 | `ARCHITECTURAL_REVIEW` |
| `fix/tbl012-m-repo-extractor` | diverged | 8 | 2 | `KEEP_ACTIVE` / forensic tooling |
| `feat/hq-autonomous-workforce-os` | diverged | 4 | 140 | `ARCHITECTURAL_REVIEW` |
| `feat/hq-operating-system` | diverged | 1 | 153 | `ARCHITECTURAL_REVIEW` |
| `feat/hq-workforce-final-hardening-20260809` | behind | 0 | 133 | `DELETE_CANDIDATE` pending safety checks |
| `feat/hq-company-library-final-20260809` | diverged | 15 | 16 | `ARCHITECTURAL_REVIEW` |
| `feat/vibetwin-p12-learning-companion` | behind | 0 | 178 | `HISTORICAL_PRESERVE` / deletion candidate after preservation checks |
| `feat/vibetwin-learning-os` | behind | 0 | 233 | `HISTORICAL_PRESERVE` / deletion candidate after preservation checks |

## 4. Critical evidence branches

### Worker Engine L0

`agent/worker-engine-freeze-l0` is **22 commits ahead and 2 behind**. Its unique changes include L0 recovery evidence, architecture freeze documentation, structural schema diff workflow, provenance sweep tooling, and the decision playbook.

**Do not delete. Do not merge blindly.** Reconciliation is an architecture task.

### Worker Engine architecture freeze

`refinement/worker-engine-architecture-freeze` is **2 ahead and 2 behind** and contains:

- `docs/WORKER_ENGINE_ARCHITECTURE_FREEZE.md`
- `docs/WORKER_ENGINE_TRACE.md`

This is architectural evidence and remains preserved.

### TBL012 M(repo) extractor

`fix/tbl012-m-repo-extractor` is **8 ahead and 2 behind** and contains:

- `.github/workflows/tbl012-m-repo-extractor.yml`
- `scripts/l0/extract-m-repo.js`
- `package.json` support

Because this branch adds automation, it must be reviewed for whether the workflow is still needed before any cleanup.

### Supabase foundation recovery

`agent/supabase-foundation-recovery` is **3 ahead and 9 behind** and contains live migration ledger/reconciliation evidence and foundation scope derivation. It is explicitly a recovery/evidence line and remains protected from cleanup.

### HQ Workroom production

`agent/hq-workroom-production` is **2 ahead and 7 behind** and contains production HQ Workroom pages and migrations. It cannot be treated as stale.

## 5. HQ architecture finding

There are multiple HQ branches with different graph positions and unique implementation evidence:

- `feat/hq-operating-system`: 1 ahead / 153 behind; substantial HQ application and migration changes.
- `feat/hq-autonomous-workforce-os`: 4 ahead / 140 behind; worker lifecycle/governance/merge-gate documentation.
- `feat/hq-company-library-final-20260809`: 15 ahead / 16 behind; large company-library schema and certification implementation.
- `agent/hq-workroom-production`: 2 ahead / 7 behind; current Workroom production implementation.
- `feat/hq-workforce-final-hardening-20260809`: 0 ahead / 133 behind; graph-level deletion candidate pending full safety gates.

**Conclusion:** HQ has genuine architectural lineage, not merely branch clutter. Canonical HQ selection must be handled separately from branch cleanup.

## 6. VibeTwin historical finding

At least two VibeTwin branches are currently fully behind `main` with zero unique commits:

- `feat/vibetwin-p12-learning-companion`: 0 ahead / 178 behind.
- `feat/vibetwin-learning-os`: 0 ahead / 233 behind.

These are strong candidates for historical preservation followed by deletion, but the audit must first determine whether their tips correspond to meaningful P-series milestones and whether tags/PR records are required.

**Important:** a branch being behind with zero unique commits means its tip state is contained in `main`; it does not mean the branch name itself is historically meaningless. The commit SHA and PR context still need preservation analysis.

## 7. Immediate candidate categories

### Category A — obvious graph candidates

Branches with `ahead_by=0` and substantial behind distance are candidates for deletion after PR/dependency verification.

### Category B — historical architecture

Old branches with unique or milestone states should be tagged and then potentially deleted as branch refs.

### Category C — active/recovery

Branches with current unique work, production evidence, security evidence, or recovery tooling remain.

### Category D — architecture conflicts

Branches with unique competing HQ, Worker Engine, VibeTwin, Content Engine, or Student OS implementations require architectural reconciliation before cleanup.

## 8. Required remaining passes

### Pass A — branch graph

Continue comparing all remaining branches against `main`. Record every relation.

### Pass B — PR state

For every `DELETE_CANDIDATE`, verify associated PR state and whether the branch was merged, closed, abandoned, or still referenced.

### Pass C — workflow/deployment references

Inspect `.github/workflows`, Vercel configuration, deployment rules, scripts, and repository governance for branch references.

### Pass D — historical preservation

For historical branches, identify the exact tip SHA and create a milestone tag when the state has architectural value.

### Pass E — unique commit archaeology

Inspect unique commits on every non-zero-ahead candidate and classify their contents as implementation, documentation, evidence, experiment, backup, or obsolete work.

### Pass F — controlled deletion

Only `DELETE_AUTHORIZED` branches may be deleted, and only in small verified batches.

## 9. Deletion gate

A branch remains protected until all boxes are proven:

- [ ] no open PR
- [ ] no relevant PR context requiring retention
- [ ] not protected
- [ ] no deployment dependency
- [ ] no workflow dependency
- [ ] no unique unreconciled commits
- [ ] no unresolved architecture role
- [ ] historical SHA preserved when necessary
- [ ] reason recorded
- [ ] post-delete verification defined

## 10. Continuation contract

Future ChatGPT sessions must read this file before acting on repository cleanup. They must continue the forensic state recorded here, update this file with new evidence, and never infer deletion safety from naming alone.

If a major architecture decision or irreversible destructive action is required, stop and request owner approval.

## 11. Current completion state

**NOT COMPLETE.**

No destructive cleanup has been performed. The audit is deliberately continuing through the remaining branch graph and safety evidence.
