# Cyborg current-main certification reconciliation — 2026-08-23

## Mission

Reconcile the historical PR #448 repository-kernel certification with current `main`, resolve the closed-unmerged PR #447 ambiguity, and close the bounded production `twin-chat` parity proof required after PR #452 without activating new runtime, schedulers, publishing, payments, database authority, or consequential worker authority.

## Canonical lineage

- PR #446 — persistent governed autonomous agent kernel — merged.
- PR #447 — lightweight repository AI operating contract — closed unmerged; superseded by the stronger #446/#448 Cyborg kernel and must not be replayed as a competing canonical head.
- PR #448 — governed Cyborg mission kernel — certified for repository kernel/runtime-gate scope at exact head `e1a7148f4a859d2a838687a4ae6b90c029eb653a`, merged as `76be882e377c231cb4ebb5b3f25584f14703d1b0`.
- PR #452 — reconciled Cyborg chat gate with live Twin entitlement — merged into current-main lineage.
- Base for this reconciliation: `0b36e472613dbbb00e36fc00e2f03cb424808ebc`.

## Historical certification correction

The prior control matrix incorrectly left `Independent certification = PROOF PENDING` after PR #448 received exact-head certification. The matrix now records the certification truthfully and scopes it to the exact historical #448 repository kernel/runtime-gate revision. It does not promote that historical evidence into a blanket certification of later revisions or production runtime adapters.

## Production parity proof

The connected production Supabase project `yauqsxggtuxuykcbrtzf` was inspected directly on 2026-08-23.

Active function evidence:

- function: `twin-chat`
- version: `28`
- status: `ACTIVE`
- JWT verification: enabled

The active deployed source contains the two bounded controls required by the PR #452 reconciliation contract:

1. Cyborg admission: the request creates or resumes a Cyborg chat mission before provider/model execution; provider calls require a non-empty mission identifier and carry the mission identifier downstream.
2. Student entitlement: student requests require a session identifier and execute `student_consume_twin_session` before the generative model call; a denied/disabled/limited entitlement returns before model execution.

Result: **VERIFIED for the bounded production chat-gate parity scope.**

This proof does not certify the separate Cyborg production persistence adapter, runtime execution adapter, restart/recovery behavior, schedulers, publishing, payments, or consequential authority. Those remain proof-pending/owner-gated as stated in `docs/CYBORG_20X_CONTROL_MATRIX.md`.

## Repository AI contract decision

The canonical architecture is:

`repository instructions -> Cyborg admission -> persistent governed mission kernel -> Cyborg-owned skill orchestration -> evidence/repair/certification gates`.

PR #447's useful policy ideas are already represented by the stronger canonical kernel: investigate-first execution, skill loading, dependency integrity, exact-head evidence, repair-until-green behavior, truthful status vocabulary, isolated-branch discipline, owner gates, and deployment conservation. No wholesale #447 replay is justified.

## Exact-head certification gate

This reconciliation changes governance documentation only. Its changed head must still pass all triggered exact-head repository checks before it may be called certified or merged. A new commit invalidates earlier changed-head evidence.

Required applicable gates include at minimum:

- Agent Governance
- Cyborg Mission Kernel Contract
- Engineering Integration Gate
- Engineering Control Plane / Phase 2 when triggered
- TypeScript and Production Build Gate / CI Production Build Contract when triggered
- applicable authorization/reliability/governance checks

## Safety

No production deployment was performed by this reconciliation. No runtime, scheduler, publishing, payment, database mutation, RLS/grant change, secret change, or consequential authority activation is authorized or performed.
