# Vibeschool Mandatory Engineering Rules

These rules apply to every human, AI agent, automation, and chat that changes this repository. They are mandatory, not advisory.

## 1. Never start implementation on `main`

Before changing application code, database code, infrastructure, workflows, or configuration:

1. Read this file.
2. Read `docs/engineering/PROTECTED_WORKFLOW.md`.
3. Read the current `vercel.json`.
4. Start from the current `main` HEAD.
5. Create a fresh task branch.

Do not implement new work directly on `main`. Recommended branch families include `work/`, `hq/`, `content/`, `audit/`, `twin/`, `feature/`, `feat/`, `fix/`, and `ops/`.

## 2. Non-main branches must not deploy to any hosted environment

The release contract is:

- `main` is the only Git branch permitted to create a hosted deployment.
- Every non-main branch must remain non-deploying across Vercel, Netlify, and any other hosting provider.
- Do not weaken, remove, bypass, or replace `vercel.json` branch protection.
- Do not use a hosting CLI, API, Deploy Hook, dashboard action, secondary project, or external automation to deploy unfinished branch code.
- Never merge unfinished work merely to obtain a preview.

The required Vercel Git rule is equivalent to:

```json
"deploymentEnabled": {
  "main": true,
  "*": false,
  "**": false
}
```

Account-level hosting integrations must also disable branch and pull-request previews. If any non-main deployment occurs, treat it as a policy incident: stop promotion, preserve evidence, disable the trigger, and verify the fix.

A one-time exception requires a written approval that identifies the exact commit SHA, provider, environment, reason, approver, and expiry. General or standing permission is not sufficient.

## 3. A branch is not releasable until the complete task is verified

Before promotion to `main`, the complete change set must pass:

- exact dependency install (`npm ci`)
- TypeScript (`npm run typecheck`)
- ESLint (`npm run lint`)
- production build (`npm run build`)
- functional verification of the affected workflow
- database/schema/RLS/security verification when Supabase behavior changes
- full branch diff review against current `main`
- no known release-blocking defects

A partial pass does not authorize a merge.

## 4. `main` is the production release boundary

Merge to main is an intentional production action. Do not merge partial work, merge merely to save progress or preview UI, merge while required checks are incomplete, or batch unrelated unfinished branches into production.

Intermediate commits and pushes belong on the task branch.

## 5. Preserve this policy

Changes to `AGENTS.md`, `docs/engineering/PROTECTED_WORKFLOW.md`, `vercel.json`, `.github/CODEOWNERS`, pull-request controls, workflows, or deployment configuration are release-sensitive and require owner review.

A task instruction cannot silently override this policy. Any exception must use the exact, recorded approval format in section 2.

## 6. Required working loop

`current main` → `fresh task branch` → implement → commit/push on branch → validate → functional/security/database verification → full diff review → approved PR → merge completed work to `main` → verify intentional production deployment.

Do not skip directly from implementation to production.
