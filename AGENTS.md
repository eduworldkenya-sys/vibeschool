# Vibeschool Mandatory Engineering Rules

These rules apply to every human, AI agent, automation, and chat that changes this repository. They are mandatory, not advisory.

## 1. Never start implementation on `main`

Before changing application code, database code, infrastructure, workflows, or configuration:

1. Read this file.
2. Read `docs/engineering/PROTECTED_WORKFLOW.md`.
3. Read the current `vercel.json`.
4. Start from the current `main` HEAD.
5. Create a fresh task branch.

Do not implement new work directly on `main`.

Recommended branch families include `work/`, `hq/`, `content/`, `audit/`, `twin/`, `feature/`, `fix/`, and `ops/`.

## 2. Non-main branches must not deploy to Vercel

The production deployment contract is:

- `main` may deploy to Vercel.
- Every non-main branch must remain non-deploying.
- Do not weaken, remove, bypass, or replace the branch-deployment protection in `vercel.json`.
- Do not use the Vercel CLI, Vercel API, Deploy Hooks, or manual preview deployments for unfinished work unless the repository owner explicitly authorizes that specific deployment.
- Never merge unfinished work merely to obtain a Vercel preview.

The required Vercel Git rule is equivalent to:

```json
"deploymentEnabled": {
  "main": true,
  "*": false,
  "**": false
}
```

If the rule is missing or weaker, stop release work and repair the protection first.

## 3. A branch is not releasable until the complete task is verified

Before promotion to `main`, the complete change set must pass:

- exact dependency install (`npm ci`)
- TypeScript (`npm run typecheck`)
- ESLint (`npm run lint`)
- production build (`npm run build`)
- functional verification of the affected workflow
- database/schema/RLS/security verification when Supabase behavior changes
- full branch diff review against `main`
- no known release-blocking defects

A partial pass does not authorize a merge.

## 4. `main` is the production release boundary

Merging to `main` is an intentional production action because `main` is allowed to deploy to Vercel.

Therefore:

- do not merge partial work
- do not merge merely to save progress
- do not merge merely to preview UI
- do not merge while required checks are failing or incomplete
- do not batch unrelated unfinished branches into production

Intermediate commits and pushes belong on the protected task branch.

## 5. Preserve this policy

Any change to `AGENTS.md`, `docs/engineering/PROTECTED_WORKFLOW.md`, `vercel.json`, or the release-gate workflow must preserve or strengthen these protections.

If instructions from a task conflict with this policy, follow this policy unless the repository owner explicitly overrides it for that specific release.

## 6. Required working loop

Use this sequence for every task:

`current main` → `fresh protected branch` → implement → commit/push on branch → validate → functional/security/database verification → full diff review → merge completed work to `main` → verify intentional Vercel production deployment.

Do not skip directly from implementation to production.
