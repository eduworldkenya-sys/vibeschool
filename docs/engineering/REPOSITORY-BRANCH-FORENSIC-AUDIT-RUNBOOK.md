# Repository Branch Forensic Audit Runbook

**Status:** Phase 1 — evidence collection prepared  
**Date:** 2026-08-11  
**Repository:** `eduworldkenya-sys/vibeschool`  
**Authority:** `docs/engineering/REPOSITORY-BRANCH-ARCHAEOLOGY-AND-CLEANUP-LOG.md`

## 1. Objective

Produce a reproducible, evidence-based inventory of every Git branch and its GitHub PR/dependency context before any destructive repository operation is authorized.

This phase is deliberately read-only. It must not delete, rename, merge, force-update, or tag any branch.

## 2. Required evidence

The audit must establish, for every branch:

- branch name;
- current tip SHA;
- last commit timestamp;
- whether the tip is reachable from `main`;
- commits ahead of and behind `main`;
- unique commits at the branch tip;
- associated PRs and their live state;
- draft/open/merged/closed status;
- branch protection status where available;
- workflow/deployment configuration references;
- architectural workstream;
- duplicate or historical relationship where proven;
- proposed disposition and evidence.

## 3. Required special investigations

### 3.1 Timetable baseline

Search full Git history for:

`20260520000000_timetable_foundation_baseline.sql`

The result must be either `FOUND` with commit/path evidence or `NOT FOUND` in reachable history. Do not infer absence from branch names.

### 3.2 VibeTwin P1–P12

Compare actual Git ancestry pairwise. Branch names do not establish a sequential architecture. Record whether each adjacent pair is ancestor/descendant, merge-base related, or divergent/parallel.

### 3.3 HQ architecture

Perform the same ancestry analysis across the HQ operating-system, workforce, nervous-system, UI-consolidation, hardening, and company-library branches.

### 3.4 Worker Engine / HQ reconciliation

Treat Worker Engine L0 branches and the existing `hq_*` workforce implementation as protected architectural evidence. No consolidation or deletion decision is made by this audit script.

## 4. Disposition rules

The generated evidence may support one of these classifications:

- `ACTIVE`
- `OPEN_PR_PROTECTED`
- `IMPORTANT_ARCHITECTURAL`
- `MERGED_CANDIDATE`
- `DUPLICATE_CANDIDATE`
- `STALE_REVIEW`
- `BLOCKED`

`SHOULD_DELETE` is a subsequent decision state, not an automatic output of the forensic script.

## 5. Stop conditions

The audit must stop and request architectural approval before:

1. deleting any branch;
2. renaming an architectural branch;
3. creating historical tags intended to replace active architectural branches;
4. closing an open PR because it is judged obsolete;
5. selecting one competing subsystem implementation as canonical;
6. reconciling or deleting HQ/Worker Engine implementation lines;
7. modifying production Supabase state;
8. changing production deployment controls.

Routine evidence collection, report generation, and documentation may continue without approval.

## 6. Execution

From a full clone with authenticated GitHub CLI access:

```bash
bash scripts/repository_branch_forensic_audit.sh
```

The script writes an evidence directory containing:

- `branches.csv`
- `pull-requests.json`
- `protection.csv`
- `config-branch-references.txt`
- `timetable-baseline-search.txt`
- `architecture-ancestry.txt`
- `metadata.csv`

The generated files are evidence artifacts. They are not an authorization to delete anything.

## 7. Approval boundary

After the evidence report is generated, the next major decision is the **Branch Disposition Review**. That review determines which branches, if any, may be preserved as milestones, closed, or deleted.

No destructive action should occur until that review is explicitly approved.
