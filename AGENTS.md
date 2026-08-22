# VibeSchool Agent Governance Kernel

This file is the mandatory first-read instruction for any AI coding agent or LLM working in this repository.

## Mandatory startup

Before proposing, editing, testing, certifying, merging, deploying, or mutating production:

1. Read this file completely.
2. Read `docs/ai-governance/CYBORG_EXECUTOR.md` and operate through the `vibeschool-cyborg-executor` orchestration contract.
3. Read `docs/ai-governance/OPERATING_DOCTRINE.md`.
4. Read `docs/ai-governance/MANDATORY_SKILLS.md` and `docs/ai-governance/SKILL_REGISTRY.json`.
5. Read `.github/control-plane/policy.json` and any more specific `AGENTS.md` in the working subtree.
6. Inspect current repository truth before relying on prior chat, handover, PR, CI, or certification claims.
7. Identify affected shared domains, dependencies, production risk, required certification class, and all applicable mandatory skill modules.

If these steps are not complete, the task is not in an executable state.

## Mandatory Cyborg orchestration

`vibeschool-cyborg-executor` is the canonical model-agnostic execution orchestrator. It selects and sequences mandatory skills, controls dependency interruption/resume, exact-head evidence, CI repair, certification semantics, merge admission, post-merge verification, and regression learning.

No agent may replace it with remembered chat instructions, a vendor-specific agent mode, or a weaker built-in skill. Vendor-specific capabilities may assist execution but must remain subordinate to the repository Cyborg contract.

## Mandatory skill application

The twelve core modules in `docs/ai-governance/SKILL_REGISTRY.json` apply according to the Cyborg selection law:

`repo-truth-first`, `contract-integrity`, `preflight-before-ci`, `test-the-test`, `ci-failure-repair-loop`, `evidence-and-certification`, `dependency-integrity-loop`, `escape-hatch-auditor`, `security-authority-gate`, `merge-certification-gate`, `regression-learning`, and `resource-conservation`.

All matching VibeSchool domain modules also apply. An agent may not opt out because a model lacks a similarly named built-in skill; the repository definition is the required behavior.

## Non-negotiable engineering law

- Never claim `DONE`, `READY`, `CERTIFIED`, `MERGE READY`, `MERGED`, or equivalent without current evidence for the exact candidate SHA.
- Historical green CI is not evidence for a changed head.
- Contrary evidence invalidates dependent completion/certification immediately.
- If later work exposes a defect in an earlier dependency, verify it, repair the canonical root cause, invalidate stale evidence, re-certify affected work, then resume.
- Never hide, downgrade, or leave a discovered material defect merely because it is outside the current priority.
- Never self-certify high-risk work. Independent evidence or an independent reviewer/evaluator is required where the control plane requires it.
- Never perform destructive production SQL, migration-history repair, auth/RLS/grant weakening, payment activation, publishing activation, scheduler activation, runtime activation, or consequential authority expansion without explicit current authorization and the required repository gates.
- Runtime, schedulers, automatic publishing, payments, and consequential worker authority are OFF unless separately and explicitly commissioned.
- Prefer read-only investigation before mutation.
- Preserve unrelated concurrent work. Do not overwrite or bundle unrelated changes.
- Use isolated branches. Do not develop directly on `main`.
- Merge only the exact head that was verified.
- Every material failure should become a regression test or executable guard when practical.
- Leave a clear handover/evidence trail for unfinished or blocked work.

## Required lifecycle

`READ GOVERNANCE -> ENTER CYBORG EXECUTOR -> APPLY MANDATORY SKILLS -> INVESTIGATE -> MAP DEPENDENCIES/RISK -> PLAN -> IMPLEMENT -> PREFLIGHT -> TEST THE TEST WHEN APPLICABLE -> SECURITY/DATA CHECK -> ESCAPE-HATCH AUDIT -> ADVERSARIAL VERIFY -> UI/RUNTIME VERIFY WHEN APPLICABLE -> EXACT-HEAD CI -> REPAIR LOOP UNTIL GREEN/BLOCKED -> INDEPENDENT CERTIFICATION WHEN REQUIRED -> MERGE GATE -> MERGE -> POST-MERGE VERIFY -> REGRESSION LEARNING`

Skipping a stage requires a written, evidence-based reason and must not weaken a required gate.

## Source of truth hierarchy

1. Current production/repository evidence and executable gates
2. Current exact-head CI/test evidence
3. Repository governance, Cyborg executor and control-plane policy
4. Current task/PR evidence
5. Handover documents
6. Conversation claims or historical summaries

When sources conflict, investigate and reconcile; never choose the more convenient source.

## Vendor-neutral rule

These rules apply equally to ChatGPT, Codex, Claude, Gemini, Copilot, Cursor, local models, autonomous agents, and VibeSchool workers. Model-specific instruction files may point here but may not weaken this file or `docs/ai-governance/CYBORG_EXECUTOR.md`.

## Enforcement

`.github/workflows/agent-governance.yml` and `scripts/validate-agent-governance.mjs` validate the presence and integrity of the governance entrypoints, Cyborg executor, and mandatory skill registry. Branch protection should require the resulting `Agent Governance` check before merge.
