# VibeSchool Repository Branch Archaeology & Cleanup Control Log

**Status:** Phase 0 — control document established; no destructive cleanup authorized  
**Date established:** 2026-08-11  
**Repository:** `eduworldkenya-sys/vibeschool`  
**Canonical production branch:** `main`  
**Document class:** Engineering control / repository governance / forensic cleanup log

---

## 1. Purpose

This document establishes the authoritative method for investigating, classifying, preserving, and eventually cleaning the VibeSchool Git branch population.

The objective is **not branch-count reduction for its own sake**. The objective is to restore clear engineering authority while preserving:

- all meaningful source history;
- architectural decisions and milestones;
- unresolved implementation work;
- security and production evidence;
- pull-request context;
- reproducibility of cleanup decisions; and
- a clear canonical implementation for each major subsystem.

The repository has accumulated branches representing active delivery, architecture experiments, subsystem evolution, temporary assembly, recovery work, security hardening, and historical milestones. Branch proliferation is therefore treated as a **symptom of architectural ambiguity**, not merely as Git hygiene.

**No branch is to be deleted solely because its name appears stale, its SHA is duplicated, or another branch appears newer.**

---

## 2. Current Control State

At the beginning of this cleanup effort, the repository presents a large branch population (previous inspection reported 112+ visible branches). That count is treated as an **observation requiring forensic verification**, not as an immutable audit result.

The current repository contains several overlapping architectural workstreams, including:

- HQ / institutional operating system;
- Worker Engine;
- VibeTwin / learning intelligence;
- Content Engine / Content Studio / textbook systems;
- Student OS / learner experiences;
- Security / Identity / Supabase foundation; and
- related curriculum and publishing infrastructure.

The immediate control decision is:

> **Destructive branch cleanup is frozen until the repository graph, GitHub PR state, dependency references, and architectural lineage have been verified.**

This document is therefore the first artifact in the cleanup process. It records the control model before any destructive action occurs.

---

## 3. Non-Negotiable Principles

### 3.1 Branch names are not evidence

Names such as `feat/*`, `fix/*`, `agent/*`, `tmp/*`, `backup/*`, `final`, `legacy`, `P1`, or `P12` are useful signals but cannot establish branch status.

Classification must be derived from Git state, GitHub state, repository references, and architectural context.

### 3.2 Same SHA does not automatically mean safe deletion

If multiple branches point to the same commit SHA, they currently reference identical repository state at their tips. This establishes pointer duplication, but it does **not** by itself establish operational disposability.

Before deletion, the audit must check at minimum:

- open or closed pull requests;
- branch protection;
- workflow references;
- deployment references;
- unique commits and ancestry;
- architectural significance; and
- required historical preservation.

### 3.3 Preserve history before simplifying references

Active development should use branches. Historical architectural states should normally be preserved with immutable tags rather than permanent development branches.

A branch is a **moving development reference**.  
A tag is an **immutable historical reference**.

### 3.4 `main` is the production authority

`main` is the canonical production lineage unless an explicit architecture decision states otherwise.

No parallel branch may silently become a second production authority.

### 3.5 Cleanup must not become an architecture migration by accident

Deleting a Git reference is repository housekeeping. Selecting which competing implementation becomes canonical is an architectural decision.

These decisions must remain separate and explicit.

### 3.6 Unknown means unsafe

If a deletion gate cannot be verified, the branch remains protected from deletion.

> **Unknown ≠ safe.**

---

## 4. Branch Classification Model

Every branch will ultimately be assigned one primary disposition:

| Classification | Definition | Default disposition |
|---|---|---|
| `ACTIVE` | Current work with a legitimate ongoing purpose | Keep |
| `IMPORTANT_ARCHITECTURAL` | Historical/canonical architecture requiring preservation | Preserve, normally via tag |
| `MERGED` | Work incorporated into canonical lineage | Delete after safety verification |
| `STALE` | No current delivery role and no required unique architecture | Review |
| `DUPLICATE` | Redundant reference to state represented elsewhere | Delete after safety verification |
| `SHOULD_DELETE` | Has passed every deletion gate | Delete in controlled batch |

`STALE` and `DUPLICATE` are **investigation classifications**, not authorization to delete.

---

## 5. Forensic Audit Requirements

The definitive audit must run against a full Git clone/ref set with live GitHub metadata. A source ZIP is insufficient because it does not contain the complete branch/ref graph.

### 5.1 Complete Git graph

The audit environment must fetch all relevant refs and prune deleted remote references before analysis.

Required capability includes:

```bash
git fetch --all --prune
```

### 5.2 Reachability and unique-commit analysis

For every branch, record:

- branch name;
- tip SHA;
- commit timestamp;
- author;
- whether the tip is reachable from `main`;
- ahead/behind relationship to `main`; and
- number and identity of commits not contained in `main`.

The critical distinction is between:

```text
branch state already incorporated into main
```

and:

```text
branch still carrying independent work
```

### 5.3 Pull-request state

GitHub PR state must be obtained directly rather than inferred from branch names or manually interpreted descriptions.

Record:

- PR number;
- open/closed state;
- merged/unmerged state;
- draft status;
- base branch;
- head branch; and
- current relationship between the branch and the PR.

**Rule:** an open PR prevents deletion until the PR is explicitly resolved.

### 5.4 Repository dependency analysis

Search for branch-name references in at least:

```text
.github/workflows/
vercel.json
scripts/
docs/
repository configuration
```

A branch referenced by automation or deployment requires explicit review before deletion.

### 5.5 Architectural lineage

For every major architecture family, establish the actual Git ancestry rather than relying on naming conventions.

Required families include:

- HQ;
- Worker Engine;
- VibeTwin;
- Content Engine / Content Studio;
- Student OS;
- Security / Identity;
- Supabase foundation; and
- textbook/publishing systems.

The audit must identify the current canonical implementation and distinguish it from historical experiments or superseded implementations.

---

## 6. Worker Engine Special Control

Worker Engine work is subject to a stricter preservation rule because it forms part of the current L0 architecture/recovery effort.

Known active work includes branches such as:

```text
agent/worker-engine-freeze-l0
fix/tbl012-m-repo-extractor
docs/worker-engine-l0-freeze-addendum
refinement/worker-engine-architecture-freeze
fix/issue-63-reproducible-baseline-20260810
fix/supabase-release-foundation-20260810
```

These branches must not be consolidated or deleted merely because they are closely related.

The repository must first reconcile:

1. Worker Engine L0 architecture;
2. repository reproducibility/baseline state;
3. existing `hq_*` workforce implementation; and
4. the boundary between deterministic system structure and specialist intelligence.

**Worker Engine branch cleanup is therefore subordinate to architectural reconciliation.**

---

## 7. Baseline Migration Investigation

The following migration requires an evidence-based determination:

```text
20260520000000_timetable_foundation_baseline.sql
```

The audit must search full reachable history and report one of exactly two outcomes:

### FOUND

```text
Found in commit: <SHA>
Path: <path>
Reachable from: <branch/tag/reference>
```

### NOT FOUND

```text
File not found in reachable repository history.
```

The report must not use branch-name inference to conclude that the migration is absent.

A statement such as "probably missing" is not an acceptable final audit result.

---

## 8. Historical Architecture: VibeTwin and HQ

### 8.1 VibeTwin P-series

The P1–P12 branches must be analysed as a Git graph before being labelled a sequential architecture.

The audit must determine whether the branches are:

- sequential descendants;
- parallel siblings;
- partially merged milestones; or
- independent experiments.

Only after this determination should they be converted from active-looking branches to immutable historical milestones.

### 8.2 HQ evolution

The same ancestry analysis applies to HQ branches, including operating-system, workforce, nervous-system, UI-consolidation, and hardening lines.

The question is not which branch has the newest or most authoritative-looking name.

The question is:

> **Which implementation became canonical, which changes were incorporated, and which branches contain unique architectural evidence that must be preserved?**

This is especially important because the existing HQ workforce implementation is part of the current Worker Engine reconciliation problem.

---

## 9. Historical Preservation Protocol

When an architectural branch is no longer active but its state is important, preserve the relevant commit with a tag before deleting the branch.

Example:

```bash
git tag milestone/vibetwin-p12 <SHA>
git push origin milestone/vibetwin-p12
```

Tags should identify finalized architectural states, releases, freezes, or other immutable milestones.

Avoid creating permanent `archive/*` branches solely to retain history unless there is an operational requirement for a branch ref.

---

## 10. Branch Deletion Safety Gate

A branch may enter the `SHOULD_DELETE` state only when **all** of the following are verified:

```text
[ ] No open PR
[ ] Not protected
[ ] No deployment dependency
[ ] No workflow/automation dependency
[ ] No unique unreconciled commits
[ ] State exists elsewhere or is deliberately preserved
[ ] Architectural significance has been evaluated
[ ] Relevant SHA has been tagged where required
[ ] Deletion decision is recorded in the audit artifact
```

If any item is unknown, deletion is prohibited.

---

## 11. Controlled Deletion Protocol

Deletion must occur in small, reviewable batches.

Recommended sequence:

1. obvious disposable duplicates;
2. verified merged branches;
3. temporary branches;
4. superseded development branches;
5. historical branches only after tagging and architecture review.

After each batch:

- query GitHub again;
- verify the expected refs disappeared;
- verify preserved refs/tags remain;
- record deleted SHAs; and
- check for unexpected PR or workflow effects.

Do not perform a single bulk deletion of the entire candidate set.

---

## 12. Audit Artifact

The cleanup must produce a machine-readable report with at least:

```text
branch
sha
commit_date
reachable_from_main
unique_commit_count
pr_number
pr_state
pr_draft
protected
workflow_dependency
deployment_dependency
architecture_role
tag_created
decision
reason
verification_timestamp
```

The report is the audit trail for every disposition.

The objective is that a future engineer can answer:

> "Why was this branch retained, archived, or deleted?"

without relying on undocumented personal memory.

---

## 13. Canonical Architecture Register

Branch cleanup is incomplete until each major subsystem has a declared canonical implementation.

The register should ultimately contain:

| Subsystem | Canonical implementation | Status | Evidence / decision |
|---|---|---|---|
| HQ | TBD by archaeology | Pending | Pending |
| Worker Engine | TBD by L0 reconciliation | Frozen/Investigating | Pending |
| VibeTwin | TBD by ancestry + architecture review | Pending | Pending |
| Content Engine | TBD | Pending | Pending |
| Student OS | TBD | Pending | Pending |
| Security / Identity | TBD | Pending | Pending |
| Supabase foundation | TBD | Pending | Pending |
| Textbook / publishing | TBD | Pending | Pending |

This register is more important than achieving a particular branch count.

---

## 14. Forward Branch Governance

After the historical cleanup, VibeSchool should operate with a deliberately small branch vocabulary.

| Prefix | Purpose | Expected lifetime |
|---|---|---:|
| `main` | Production authority | Permanent |
| `feat/<workstream>` | New feature/workstream | Until merged or abandoned |
| `fix/<workstream>` | Bug/security/hardening work | Until merged or abandoned |
| `spec/<decision>` | Architecture/design decision not yet implemented | Until decision is resolved |
| `milestone/<name>` | Immutable historical state | Permanent tag/reference |

The repository should not create a new branch merely because a new chat session, day, or agent session begins.

**One conceptual workstream = one active branch.**

---

## 15. Lifecycle Controls

Age is a review signal, not an automatic deletion rule.

Suggested review thresholds:

- `fix/*`: review after 14 days;
- `feat/*`: review after 30 days;
- `spec/*`: review after 14 days;
- temporary branches: review within 7 days;
- backup branches: review within 7 days;
- security/auth/RLS/grant branches: review within 7 days.

A review may result in:

```text
MERGE
CLOSE + DELETE
EXTEND WITH EXPLICIT REASON
ARCHIVE AS MILESTONE
```

There should be no silent, indefinite branch state.

---

## 16. Pull Request Lifecycle

The intended lifecycle is:

```text
CREATE
  ↓
DEVELOP
  ↓
PR
  ↓
VERIFY
  ↓
MERGE ─────────→ DELETE BRANCH
  or
CLOSE ─────────→ DELETE BRANCH
```

An open PR that is no longer wanted must be explicitly closed before its branch becomes a deletion candidate.

A merged PR should normally have its head branch deleted once any required post-merge verification is complete.

---

## 17. Security-Sensitive Branches

Branches touching any of the following receive accelerated review:

- authentication;
- authorization;
- RLS;
- RPC grants;
- identity ownership;
- Supabase permissions;
- secrets;
- deployment security; or
- production access controls.

The policy is not to delete these branches because they are old. The policy is to determine whether their changes are:

- merged;
- superseded;
- still required; or
- obsolete and safely removable.

The principal security risk is accidental resurrection or reintroduction of obsolete security state.

---

## 18. Phase Model for This Cleanup

### Phase 0 — CONTROL

**Current phase.** Establish this document and freeze destructive cleanup.

### Phase 1 — FORENSIC INVENTORY

Build the complete branch/ref/PR/dependency dataset.

### Phase 2 — ARCHITECTURE MAPPING

Identify canonical implementations and historical lineage for each major subsystem.

### Phase 3 — BASELINE VERIFICATION

Resolve the status of the timetable foundation baseline and other repository-foundation questions.

### Phase 4 — PRESERVATION

Create immutable milestone tags for architecture that must survive branch cleanup.

### Phase 5 — SAFE CLEANUP

Delete only branches that pass every deletion gate.

### Phase 6 — CANONICALIZATION

Reduce each active workstream to one authoritative development branch.

### Phase 7 — GOVERNANCE

Automate or routinely execute branch/PR lifecycle checks so the repository does not return to uncontrolled branch proliferation.

---

## 19. Current Decision Log

### 2026-08-11 — Initial cleanup control established

**Decision:** Do not begin destructive branch deletion based on branch names, duplicate SHAs, or prior prose summaries alone.

**Reason:** The current branch population has architectural, PR, security, and historical dependencies that require verification against the actual Git graph and live GitHub state.

**Action:** Establish this document before cleanup.

**Destructive operations authorized:** None.

**Next required action:** Execute the full forensic branch audit and populate the audit artifact.

---

## 20. Definition of Done

The repository cleanup is complete only when all of the following are true:

- every relevant branch has a documented disposition;
- every open PR has an explicit status;
- every important architectural state has a durable reference;
- no required implementation exists only on an undocumented branch;
- the canonical implementation of each major subsystem is known;
- the baseline investigation has an evidence-based result;
- deletion decisions are reproducible from the audit artifact;
- obsolete branches have been removed in controlled batches; and
- forward branch governance is in place.

**Success is not "112 branches became 30 branches."**

Success is:

> **VibeSchool has one clear production authority, explicit subsystem ownership, preserved architectural history, reproducible cleanup decisions, and a branch lifecycle that does not depend on one person's memory.**
