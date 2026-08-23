# Canonical Agent Guardrails

These guardrails are mandatory Cyborg-owned engineering skills. They strengthen the existing VibeSchool governance system; they do not create a second runtime, admission system, certification ledger, authority path, or deployment controller.

## canonical-architecture-guardrail

Before creating or changing any worker executor, model/provider gateway, admission token/capability, certification/evidence store, authority mechanism, mission lease, budget system, runtime control, stop control, or consequential execution gateway:

1. Inspect current canonical repository and production truth.
2. Identify the existing authoritative component and its invariants.
3. Extend or repair that component rather than creating a competing path.
4. Treat a new parallel authority or execution path as denied unless an explicit architecture decision proves replacement is required and includes migration, deprecation, reconstruction, rollback and independent assurance.
5. Run canonical convergence / architecture invariant checks before certification.

Default rule: **extend canonical truth; do not fork authority.**

## exact-head-pr-certification-guardrail

Repository mutations must follow this sequence unless a recorded NOT_APPLICABLE reason is valid:

`CURRENT MAIN -> ISOLATED BRANCH -> IMPLEMENT -> PREFLIGHT -> TEST/NEGATIVE PATHS -> PR -> EXACT-HEAD REQUIRED CI -> FRESHNESS CHECK -> MERGE EXACT VERIFIED HEAD -> RESULTING-MAIN/POST-MERGE VERIFY`

Historical green checks, a previous branch SHA, stale review evidence, or narrative confidence cannot authorize merge. If `main` or the PR head moves in a way that invalidates evidence, affected certification returns to stale/pending and must be rerun.

## activation-authority-guardrail

Code-writing, testing, review, repair and merge authority do not imply commissioning authority.

Unless explicit current owner authorization and the required commissioning gates exist, agents must preserve these defaults:

- Worker runtime OFF.
- Schedulers / heartbeat automation OFF.
- Automatic publishing OFF.
- Payments OFF.
- Consequential worker authority not expanded.
- Global Stop and equivalent fail-closed controls not defeated or silently relaxed.

Tests may exercise isolated/synthetic/shadow-safe paths, but test setup must not mutate production activation state without explicit authority.

## evidence-status-guardrail

Status language is an auditable claim, not a writing style.

- `IMPLEMENTED`: code/config exists at the stated SHA.
- `VERIFIED`: required direct evidence for that exact SHA is fresh and green.
- `CERTIFIED`: all required evidence grades, independent assurance and control-plane conditions are satisfied for that exact SHA.
- `MERGE READY`: exact-head checks/reviews/freshness are current and no blocking contradiction remains.
- `MERGED`: GitHub proves the intended verified head was merged.
- `POST-MERGE VERIFIED`: required resulting-main and production/runtime checks pass.
- `PRODUCTION READY` or equivalent requires production-appropriate evidence; code inspection or CI alone is insufficient.

If evidence is missing, stale, contradictory, scoped more narrowly than the claim, or unavailable, the agent must report the narrower proven state instead of upgrading the claim.

## Enforcement

These guardrails are subordinate to `vibeschool-cyborg-executor` and must be represented in `SKILL_REGISTRY.json`, `MANDATORY_SKILLS.md`, `AGENTS.md`, and `scripts/validate-agent-governance.mjs`. Governance CI must fail if any mandatory guardrail is removed from those canonical sources.
