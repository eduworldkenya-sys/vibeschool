# Vibeschool Protected Work and Release Policy

This policy is mandatory for all engineering work.

## 1. Start from main, never work directly on main

Every new task begins on a fresh branch created from the current `main` HEAD.

Approved non-deploying branch families:

- `work/<task>` — default for normal product work
- `hq/<task>` — HQ/control-plane work
- `content/<task>` — publishing/content-engine work
- `audit/<task>` — audit and repair work
- `twin/<task>` — learner/teacher Twin work
- `feature/<task>` — isolated features
- `fix/<task>` — isolated fixes
- `ops/<task>` — engineering/operations work

Do not implement new work directly on `main`.

## 2. Work branches must not deploy to Vercel

`vercel.json` disables Git-triggered Vercel deployments for every approved work-branch family above.

This means work can be committed and pushed to GitHub for backup, collaboration, CI, and review without creating a Vercel deployment.

Do not use Vercel CLI, Deploy Hooks, the Vercel API deployment endpoint, or manual Vercel deployment actions from a protected work branch.

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

The GitHub workflow `.github/workflows/typescript-build-gate.yml` runs the TypeScript, lint, and production-build gates on protected work branches and pull requests targeting `main`.

## 4. Release deliberately

Only after all gates pass should the completed branch be promoted to `main`.

`main` is the intentional release branch. It is not covered by the protected work-branch Vercel deny patterns, so a merge/push to `main` may create the intentional production deployment.

Do not merge partial work merely to preview it.

## 5. Preview unfinished work without Vercel

Use a local/dev-server or GitHub-hosted development environment for unfinished UI review. A preview must not require merging partial work into `main`.

## 6. One task, one release unit

Prefer a coherent completed change set over repeated small production releases. Intermediate commits are allowed on the protected branch because they do not deploy to Vercel; production promotion happens only when the whole task is ready.

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
- Is this an intentional production release?

If any answer is NO, keep the work on the protected branch and do not promote it to `main`.
