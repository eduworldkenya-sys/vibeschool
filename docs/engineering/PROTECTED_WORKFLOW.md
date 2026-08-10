# Vibeschool Protected Work and Release Policy

This policy is mandatory for all engineering work. The root `AGENTS.md` is the entry point for humans, AI agents, automations, and chats.

## 1. Start from current main

Every task begins on a fresh branch created from current `main`. Do not implement directly on `main`.

Approved families include `work/`, `hq/`, `content/`, `audit/`, `twin/`, `feature/`, `feat/`, `fix/`, and `ops/`. CI must still validate branches outside these families so an arbitrary branch name cannot bypass the gate.

## 2. Only main may deploy to a hosted environment

`main` is the production release boundary. Every non-main branch and pull request must remain non-deploying on Vercel, Netlify, and every other hosting provider.

The required Vercel protection is:

```json
"deploymentEnabled": {
  "main": true,
  "*": false,
  "**": false
}
```

Both deny patterns are mandatory because branch names may contain `/`. Repository code must not contain alternative deployment commands, APIs, or hooks that bypass this rule.

Provider settings are part of the control boundary. Disable Netlify Deploy Previews and branch deploys, Vercel preview deployments, secondary hosting projects, and equivalent Git integrations for non-main refs.

A non-main deployment is a policy incident even if the build succeeds. Stop promotion, preserve the provider log and commit SHA, disable the trigger, and verify with a later non-main commit.

An exception is valid only when a written approval records the exact commit SHA, provider, environment, reason, approver, and expiry. It does not authorize later commits or another provider.

## 3. Validate before release

A branch is releasable only after:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. functional verification
6. database/schema/RLS/security verification when relevant
7. full diff review against current `main`
8. no known release blocker

The `Full Linux validation` job performs repository-policy, TypeScript, lint, and build checks on every pushed branch and on pull requests targeting `main`. Human evidence requirements must be recorded in the PR template. A partial pass does not authorize a merge.

## 4. Merge to main is an intentional production action

Do not merge partial work, merge to save progress, merge to preview UI, combine unrelated unfinished branches, or merge while required checks or evidence are incomplete.

GitHub must protect `main` with a ruleset requiring pull requests, the `Full Linux validation` check, current-base validation, conversation resolution, code-owner review for release-sensitive files, and blocking force pushes and deletion. Bypass access should be empty or restricted to audited emergency use.

## 5. Preview unfinished work locally

Use a local development server or GitHub-hosted development environment. Do not create a public hosted preview for unfinished branch work.

## 6. Sensitive controls

The following require code-owner review:

- `AGENTS.md`
- `docs/engineering/PROTECTED_WORKFLOW.md`
- `vercel.json`
- `.github/CODEOWNERS`
- `.github/workflows/`
- pull-request templates
- hosting and deployment configuration

CODEOWNERS routes review; the GitHub ruleset must require code-owner approval for it to block merging.

## 7. Required loop

`current main` → `fresh task branch` → implement → validate → evidence → full diff review → approved PR → merge complete work to `main` → verify intentional production deployment.

If any release answer is NO, do not merge to `main` and do not deploy.
