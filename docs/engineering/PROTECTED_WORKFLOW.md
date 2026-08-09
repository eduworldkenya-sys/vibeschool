# Vibeschool Protected Work and Release Policy

This policy is mandatory for all engineering work. The root `AGENTS.md` is the entry-point rule for humans, AI agents, automations, and chats working in this repository.

## 1. Start from current main, never implement directly on main

Every new task begins on a fresh branch created from the current `main` HEAD.

Approved branch families include:

- `work/<task>` — normal product work
- `hq/<task>` — HQ/control-plane work
- `content/<task>` — publishing/content-engine work
- `audit/<task>` — audit and repair work
- `twin/<task>` — learner/teacher Twin work
- `feature/<task>` or `feat/<task>` — isolated features
- `fix/<task>` — isolated fixes
- `ops/<task>` — engineering/operations work

Do not implement new work directly on `main`.

Before implementation, read `AGENTS.md`, this policy, and the current `vercel.json`.

## 2. Only main may deploy to Vercel through Git

The repository production contract is deliberately asymmetric:

- `main` is the production release boundary and may create a Vercel production deployment.
- every non-main branch must remain non-deploying.

The required `vercel.json` protection is equivalent to:

```json
"deploymentEnabled": {
  "main": true,
  "*": false,
  "**": false
}
```

Both deny patterns are required because work branches may contain `/` characters.

Do not weaken, remove, bypass, or replace this protection. Do not use Vercel CLI, Deploy Hooks, the Vercel API deployment endpoint, or manual Vercel preview deployments for unfinished work unless the repository owner explicitly authorizes that specific deployment.

## 3. Validate the complete change set before release

Before a branch may be promoted to `main`, the complete task must be finished and reviewed. Required gates are:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. functional verification of the affected workflow
6. database/schema/RLS/security verification when Supabase behavior changes
7. review of the full branch diff against `main`
8. no known release-blocking defects

The GitHub workflow `.github/workflows/typescript-build-gate.yml` performs repository-policy validation plus TypeScript, lint, and production-build checks on protected work branches and pull requests targeting `main`.

A partial pass does not authorize a merge.

## 4. Merge to main is an intentional production action

Because `main` may deploy to Vercel, promotion to `main` is not merely source-control housekeeping. It is a production release action.

Therefore:

- do not merge partial work
- do not merge merely to save progress
- do not merge merely to preview UI
- do not merge unrelated unfinished branches together
- do not merge while required checks are failing or incomplete

Intermediate commits and pushes belong on the protected task branch.

## 5. Preview unfinished work without Vercel

Use a local/dev-server or GitHub-hosted development environment for unfinished UI review. A preview must not require merging partial work into `main` or creating a Vercel deployment.

## 6. Preserve the guardrails

Changes to any of these files are security/release-sensitive:

- `AGENTS.md`
- `docs/engineering/PROTECTED_WORKFLOW.md`
- `vercel.json`
- `.github/workflows/typescript-build-gate.yml`

Any modification must preserve or strengthen the protected-branch and release-gate rules.

## 7. Required working loop

Use this sequence for every task:

`current main` → `fresh protected branch` → implement → commit/push on branch → validate → functional/security/database verification → full diff review → merge completed work to `main` → verify the intentional Vercel production deployment.

## Release decision

A task is releasable only when the answer to all of these is YES:

- Is the task complete?
- Is the branch based on the intended current `main` baseline?
- Is the repository policy intact?
- Is the branch still non-deploying to Vercel?
- Is TypeScript clean?
- Does lint pass?
- Does the production build pass?
- Has the affected workflow been functionally verified?
- Have Supabase/schema/RLS/security effects been verified where relevant?
- Has the full branch diff been reviewed?
- Is there no known blocker?
- Is promotion to `main` intentional and production-ready?

If any answer is NO, do not merge to `main` and do not deploy to Vercel.
