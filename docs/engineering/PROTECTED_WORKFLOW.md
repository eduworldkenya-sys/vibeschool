# Vibeschool Protected Work and Release Policy

This policy is mandatory for all engineering work.

## 1. Start from main, never work directly on main

Every new task begins on a fresh branch created from the current `main` HEAD.

Approved branch families:

- `work/<task>` — default for normal product work
- `hq/<task>` — HQ/control-plane work
- `content/<task>` — publishing/content-engine work
- `audit/<task>` — audit and repair work
- `twin/<task>` — learner/teacher Twin work
- `feature/<task>` — isolated features
- `fix/<task>` — isolated fixes
- `ops/<task>` — engineering/operations work

Do not implement new work directly on `main`.

## 2. Git must not automatically deploy to Vercel

`vercel.json` sets `git.deploymentEnabled` to `false` globally.

Therefore commits and pushes on work branches — and merges/pushes to `main` — must not create automatic Vercel deployments. GitHub is the source-control and validation plane; Vercel deployment is a separate release action.

Do not use Vercel CLI, Deploy Hooks, the Vercel API deployment endpoint, or manual Vercel deployment actions while a task is still under development or verification.

## 3. Validate the complete change set before release

Before a branch may be promoted to `main`, the complete task must be finished and reviewed. Required gates are:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. Functional verification of the affected workflow
6. Database/security verification when Supabase behavior changes
7. Review of the full branch diff against `main`
8. No known release-blocking defects

The GitHub workflow `.github/workflows/typescript-build-gate.yml` runs the TypeScript, lint, and production-build gates on approved work branches and pull requests targeting `main`.

## 4. Merge and deployment are separate decisions

Only after all gates pass should the completed branch be promoted to `main`.

Merging to `main` does not authorize a Vercel deployment by itself. Production deployment must be an explicit, intentional release step after the merged `main` commit is identified and all final gates remain green.

Do not merge partial work merely to preview it.

## 5. Preview unfinished work without Vercel

Use a local/dev-server or GitHub-hosted development environment for unfinished UI review. A preview must not require merging partial work into `main` or creating a Vercel deployment.

## 6. One task, one release unit

Prefer a coherent completed change set over repeated small production releases. Intermediate commits are allowed on the protected branch because Git-triggered Vercel deployment is disabled; production deployment happens only after the whole task is ready and deliberately released.

## Release decision

A task is releasable only when the answer to all of these is YES:

- Is the task complete?
- Is the branch based on the intended `main` baseline?
- Is TypeScript clean?
- Does lint pass?
- Does the production build pass?
- Has the affected workflow been functionally verified?
- Have Supabase/schema/RLS effects been verified where relevant?
- Has the full branch diff been reviewed?
- Is there no known blocker?
- Has the completed branch been promoted to `main`?
- Is this an intentional production release?

If any answer is NO, do not deploy to Vercel.
