## Scope

- Task and intended outcome:
- Why this is one coherent release unit:

## Protected workflow

- [ ] Branch was created from current `main`; no implementation occurred directly on `main`.
- [ ] This branch and PR did not create a hosted deployment on Vercel, Netlify, or another provider.
- [ ] Supabase Preview Branching did not create a hosted branch; non-main database verification used only an isolated local stack.
- [ ] No workflow linked to or mutated a hosted Supabase project from this branch.
- [ ] Full diff against current `main` was reviewed.
- [ ] No unrelated unfinished work is included.
- [ ] Merge to `main` is an intentional production release.

## Verification evidence

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Affected workflow was functionally verified.
- [ ] Supabase schema, migration, RLS, and security effects were verified or are not applicable.
- [ ] No known release blocker remains.

Evidence and test results:

## Deployment exception

Normally leave this section as `None`.

If a non-main deployment was explicitly authorized, record all fields:

- Commit SHA:
- Provider:
- Environment:
- Reason:
- Approver:
- Approval record:
- Expiry:
