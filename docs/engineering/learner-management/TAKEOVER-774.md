# Learner management #774 — takeover checkpoint

Status: **NOT CERTIFIED**. This is an implementation checkpoint, not a release or pilot claim.

## Lineage and authority

- Verified main: `8db8bb6ea7e5d93ac1e26ca32b1473ff590ed0b7`.
- Existing PR #775 candidate: `5f36b1870cd5bb7b19379118e25c870984c2747f`; preserved as an ancestor.
- User authorized takeover and integration to main. No new approval is needed for routine repairs/tests.
- Supabase `yauqsxggtuxuykcbrtzf` inspected read-only. No production schema/data mutations, deployment or merge performed at this checkpoint.
- Existing `vercel.json` allows main and disables other branches; checkpoint pushes must not spend preview deployments.
- Mission: `CYBORG-20261016162957-291eff`. Prior broad Teacher OS mission remains incomplete; its overlapping lease was checkpointed and transferred, not certified or discarded.

## Implemented candidate

1. Preserve #775 creation context, assigned-subject links, account filters, multi-group display and canonical CBC normalization.
2. Global and per-class rosters share the canonical enrollment-first reader. Enrollment pagination and bounded identity batches prevent truncation beyond the API row limit. Missing identities produce a recoverable error rather than silently disappearing.
3. Saved identity and all eight About sections are readable immediately. Empty sections use compact rows; overview-only summaries no longer push About details down the page. Explicit edit buttons open the existing accessible detail sheet; saved content is not truncated behind disclosure arrows.
4. Independent field drafts survive other field saves and sheet switches. Save locks prevent repeated dispatch; finally releases the UI on transport errors.
5. New database trigger serializes About revisions, rejects stale bases and altered request replays, retains immutable context history and forbids broadening context visibility. No new identity/event table or SECURITY DEFINER write path.
6. An RLS-respecting SECURITY INVOKER projection reads the latest About values independently of the 120-row general timeline limit.
7. Proposed evidence policies require release for parent/learner gradebook access, enforce active canonical class/subject assignment and current enrollment, and prevent authorship alone from retaining teacher read access after assignment removal. Existing admin roles are preserved with active profile/school checks. These policies are **not deployed**.
8. Duplicate More Actions card removed; assessment navigation labels describe viewing records. Sparse assessment messaging no longer implies attendance/work are absent.

## Local evidence

- Canonical learner, #774 client/CBC, evidence-policy source, context propagation and school-life contracts: PASS.
- Shared reader: 1,201 learners, bounded identity batches, school/current filters, missing identities and error propagation: PASS. This is client-contract evidence, not a database performance benchmark.
- Isolated PostgreSQL: exact canonical class-access helper and event RLS, new context trigger/projection and proposed evidence policies: PASS. Includes class/subject/other-school/parent/learner/anon boundaries, disabled/removed teacher, departed learner, stale base, replay conflict and history rewrite denial.
- Negative control: removing the stale-base comparison makes its regression fail: PASS.
- Actual component browser suite: 111 assertions at 320/360/390/412/768/1440px, including existing in-place School Life flows, identity conflict, independent About drafts, save/re-enter, retry and focus: PASS on the checkpoint's working content. Synthetic network fixtures are explicit and are not production/RLS proof.
- TypeScript: PASS. Lint: exit 0 with pre-existing repository warnings. Production build with nonsecret synthetic Supabase configuration: PASS. Any later source change requires affected checks again.
- Existing production browser session verified the learner list and test learner profile read-only; this does not prove candidate deployment.

## Unfinished release gates (do not silently drop)

- Reconcile and independently test PR #761 formal leadership and canonical school-library changes; preserve existing resources design. Its three migrations are not deployed. Verify current circulation before considering migration/backfill.
- Persist/recover unsaved drafts across reload/network loss with scoped cleanup and retained operation/base identities; current About drafts are memory-only.
- Complete term/date windows, provenance, assessment/work/attendance completeness and progressive source loading. A bounded record window must not be presented as lifetime totals.
- Complete roster presentation/search/filter/bulk parity and authenticated transfer/exit/duplicate lifecycle tests.
- Measure 50/200/1000 realistic rosters and query plans against declared budgets; fixture pagination is not performance certification.
- Run actual all-role/two-school authenticated browser journeys, offline/slow network and concurrent-tab tests. Isolated SQL role tests are only one layer.
- Run exact-head CI and independent security/migration/diff assurance. No self-certification or historical CI substitution.
- Reconcile production migration versions/bodies without editing history blindly. Apply only independently verified forward changes, then merge the exact green candidate and verify deployment SHA plus safe live read-after-write.
- Produce the complete #774 requirement inventory and evidence packet; run the installed skill's evidence-packet validator before any certification claim.

## Reproduction

`npm ci --ignore-scripts --no-audit --no-fund`

`node scripts/test-current-roster.mjs`

`SCHOOL_LIFE_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-learner-context-database.mjs`

`LEARNER_UI_MODULES=/absolute/path/to/test/node_modules CHROMIUM_PATH=/optional/chromium node scripts/test-learner-workspace.mjs`

`npm run typecheck && npm run lint`

Use the nonsecret Supabase URL/key in the learner workflow for build-only validation. Never expose production credentials in fixtures, logs or artifacts.

## Recovery

Keep application code off main until the new projection and policies pass release gates. If a later rollout must be reverted, restore the prior application before removing its projection; preserve learner-event rows. Do not undo release-only parent/learner visibility by restoring the prior permissive read policies. Any alteration of the revision trigger requires a reviewed forward migration; never delete history to resolve an edit conflict.

## Advisor review (read-only, 16 October)

Security advisors include anonymous/authenticated execute warnings for `class_group_enforce_scope()` and `teacher_learner_event_enforce_scope()`. Both return `trigger`; PostgreSQL does not permit invoking a trigger function as an ordinary function. Treat these as function-specific hardening follow-ups, not proof of arbitrary data access. Do not bulk-revoke canonical application RPCs. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable.

Performance advisors identify missing foreign-key indexes and per-row auth calls on learner/enrollment/evidence/library tables. The new gradebook policy uses an init-plan for user identity; other existing policies and indexes still need measured query-plan review. No mass index/policy changes were made. See https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan.
