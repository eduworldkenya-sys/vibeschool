# VibeSchool Agent Governance Kernel

This file is the mandatory first-read instruction for any AI coding agent or LLM working in this repository.

## Mandatory startup

Before proposing, editing, testing, certifying, merging, deploying, or mutating production:

1. Read this file completely.
2. Read `docs/ai-governance/CYBORG_EXECUTOR.md` and enter the `vibeschool-cyborg-executor` orchestration contract.
3. Read `docs/ai-governance/OPERATING_DOCTRINE.md`.
4. Allow Cyborg to load/select the skill inventory in `docs/ai-governance/SKILL_REGISTRY.json` and definitions in `docs/ai-governance/MANDATORY_SKILLS.md`.
5. Read `.github/control-plane/policy.json` and any more specific `AGENTS.md` in the working subtree.
6. Inspect current repository truth before relying on prior chat, handover, PR, CI, or certification claims.

If these steps are not complete, the task is not in an executable state.

## Mandatory Cyborg ownership

`vibeschool-cyborg-executor` is the authoritative model-agnostic owner and orchestrator of the repository engineering skill system.

All core skills and VibeSchool domain skills are subordinate modules owned by Cyborg. Cyborg selects them, orders them, evaluates their evidence, propagates failures, controls state transitions, determines when independent assurance is required, and admits or rejects merge progression.

No agent may independently opt out of a Cyborg-selected skill, invoke a repository skill as a way to bypass Cyborg, self-certify from a subordinate skill result, or replace Cyborg with remembered chat instructions or a vendor-specific agent mode. Vendor capabilities may assist execution but remain subordinate to Cyborg and repository gates.

## Skill inventory

Cyborg owns these core modules: `repo-truth-first`, `contract-integrity`, `preflight-before-ci`, `test-the-test`, `ci-failure-repair-loop`, `evidence-and-certification`, `dependency-integrity-loop`, `escape-hatch-auditor`, `security-authority-gate`, `merge-certification-gate`, `regression-learning`, and `resource-conservation`.

Cyborg also owns and selects applicable VibeSchool domain modules: `worker-engine-governance`, `supabase-rls-security`, `content-factory-quality`, `hq-ux-operational-truth`, `journey-integrity`, `production-readiness`, and `observability-watchdog-reliability`.

The machine-readable ownership and activation contract is `docs/ai-governance/SKILL_REGISTRY.json`; detailed definitions are in `docs/ai-governance/MANDATORY_SKILLS.md`.

## Non-negotiable engineering law

- Never claim `DONE`, `READY`, `CERTIFIED`, `MERGE READY`, `MERGED`, or equivalent without current evidence for the exact candidate SHA.
- Historical green CI is not evidence for a changed head.
- Contrary evidence invalidates dependent completion/certification immediately.
- If later work exposes a defect in an earlier dependency, verify it, repair the canonical root cause, invalidate stale evidence, re-certify affected work, then resume.
- Never hide, downgrade, or leave a discovered material defect merely because it is outside the current priority.
- Never self-certify high-risk work. Independent evidence or an independent reviewer/evaluator is required where the control plane requires it.
- Never perform destructive production SQL, migration-history repair, auth/RLS/grant weakening, payment activation, publishing activation, scheduler activation, runtime activation, or consequential authority expansion without explicit current authorization and required repository gates.
- Runtime, schedulers, automatic publishing, payments, and consequential worker authority are OFF unless separately and explicitly commissioned.
- Prefer read-only investigation before mutation.
- Preserve unrelated concurrent work. Do not overwrite or bundle unrelated changes.
- Use isolated branches. Do not develop directly on `main`.
- Merge only the exact head that was verified.
- Every material failure should become a regression test or executable guard when practical.
- Leave a clear handover/evidence trail for unfinished or blocked work.

## Required lifecycle

`READ GOVERNANCE -> ENTER CYBORG -> CYBORG SELECTS/ORDERS SKILLS -> INVESTIGATE -> MAP DEPENDENCIES/RISK -> PLAN -> IMPLEMENT -> PREFLIGHT -> TEST INTEGRITY -> SECURITY/DATA CHECK -> ESCAPE-HATCH AUDIT -> ADVERSARIAL VERIFY -> UI/RUNTIME VERIFY WHEN APPLICABLE -> EXACT-HEAD CI -> REPAIR LOOP UNTIL GREEN/BLOCKED -> INDEPENDENT ASSURANCE WHEN REQUIRED -> CYBORG CERTIFICATION DECISION -> MERGE GATE -> MERGE -> POST-MERGE VERIFY -> REGRESSION LEARNING`

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

`.github/workflows/agent-governance.yml` and `scripts/validate-agent-governance.mjs` validate the governance entrypoints, authoritative Cyborg ownership, per-skill ownership/activation metadata, and mandatory skill inventory. Branch protection should require the resulting `Agent Governance` check before merge.
