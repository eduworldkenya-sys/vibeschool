# Canonical Learning Assets — Handover Log

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-r3-20260818`
PR: `#252`
Exact reconciliation base main: `532e31e4bde5a0733fad7c0deeaca410374c24e8`
Reconciliation commit: `2ec0ec96636eb8ecdd4d217a54469a7693f0de8a`
Production Supabase: unchanged pending exact-head certification
Vercel: no direct action; non-main Git deployments remain disabled by repository config

## Mission

`curriculum need -> deterministic family identity -> certified lookup -> reuse hit OR unique governed content-gap claim -> atomic credit reservation -> research/generate -> independent verification -> certify immutable version -> adopt/pin delivery`

This architecture applies to lesson plans, notes, homework, quizzes, exercises, revision, worksheets, assessments, worked examples, projects/practicals, remedial/enrichment resources, marking schemes, rubrics and reusable content blocks.

## Architectural authority

1. `learning_resources` is the canonical reusable family/root authority. Do not create another canonical-content root.
2. `learning_resource_versions` is the immutable exact-version authority.
3. `teaching_resource_links` remains the bridge from reusable inventory to contextual teaching/delivery and carries the exact version pin.
4. Existing unified assessment authorities remain the question/assessment authority.
5. Teacher, school, class, learner, deadline and private teaching context must never enter global canonical identity or reusable candidate payloads.
6. Only independently certified versions are reusable across unrelated teachers/schools.
7. Search/model spend is permitted only after the canonical single-flight gate returns `claimed` and the exact claim atomically reserves one Vibe Credit.

## Exact-current-main reconciliation

The previous R3 branch had drifted far behind a rapidly advancing `main`. A whole-tree reparent was explicitly rejected because it could delete newer certified Student=1, Worker Engine and auth work.

The final reconciliation method is deterministic and lossless:

`current main tree -> overlay exactly the intended R3 paths -> new single-parent commit`

Before rebuilding, the three pre-existing application seams modified by R3 were compared across the old R3 merge base and current `main`:

- `components/teacher/LessonPlanModal.tsx`
- `lib/teaching/lessonSource.ts`
- `lib/teaching/lessonWorkspace.ts`

None had changed on `main` during the intervening commits. The initial other R3 paths were additive. Immediately after reconciliation, GitHub compared the branch as `0 behind / 1 ahead` of `532e31e4...`, with only intended R3 paths and no unrelated deletion or modification.

## Completed reusable-content authority

- deterministic curriculum-addressable family identity;
- certified lookup before any generation;
- immutable `learning_resource_versions` lineage;
- authenticated clients can read certified versions only;
- candidate/verified/rejected/retired payloads remain hidden from normal browser access;
- platform visibility extends the existing `fn_learning_resource_visible()` authority rather than bypassing it;
- atomic single-flight `hit | pending | claimed` generation ownership with expiry/recovery;
- PostgreSQL-computed candidate SHA-256;
- one inflight candidate/verified version suppresses duplicate generation;
- exact reusable version pin on contextual lesson delivery.

## Governed promotion authority

Generated output cannot certify itself.

The final authority chain is:

`candidate -> service verification -> platform-owner certification -> reusable certified version`

Service workers may verify or reject candidate content. Direct service-role lifecycle UPDATE is revoked by the promotion authority. Only the authenticated platform-owner lane may certify or retire a version. Certified content cannot be deleted and its payload/evidence cannot be edited; retirement preserves immutable history.

## Application wiring completed

The former application gap is closed.

Lesson Workspace now preserves `grade` and carries stable persisted curriculum/sub-strand identity. Scheme/national curriculum resolution no longer manufactures canonical identity from strand-name text equality.

Authoritative lesson generation now follows:

`Lesson Workspace source -> curriculumId + subjectId + grade + subStrandId -> canonical generator -> hit/pending/claimed -> contextual teacher lesson -> exact resource-version pin`

If an authoritative curriculum source is linked but any required stable UUID identity is missing, canonical generation fails closed. It does not fall back to fuzzy title/topic matching.

Custom free-text topics remain supported through the contextual lesson generator but are deliberately excluded from shared canonical inventory.

Teacher focus remains private/local: it may customize the teacher's contextual lesson copy after canonical retrieval/generation but is not sent into the reusable family identity or candidate prompt.

## R3.6 economic concurrency and crash recovery

A deeper review found a different-gap concurrency defect in the first R3 generator: the wallet was checked before Tavily/Groq work but actually deducted only after candidate deposit. Two simultaneous requests for different curriculum gaps could therefore both incur external cost while competing for one remaining Vibe Credit.

That gap is closed by:

- `20260818214000_canonical_learning_resource_credit_reservation.sql`
- `20260818214100_canonical_learning_resource_credit_recovery.sql`

The final economic sequence is:

`recover expired claims -> canonical hit/pending/claimed gate -> atomically reserve one credit on the exact claimed gap -> Tavily -> Groq -> candidate deposit -> reservation committed`

`cla_reserve_learning_resource_credit(...)` locks both the exact claim and the teacher wallet, so separate simultaneous gaps cannot spend the same remaining balance. It preserves the existing three-credit first-use behavior, writes the spend ledger atomically, and records the reservation on the claim.

If generation fails before candidate deposit, `cla_refund_learning_resource_credit(...)` restores the uncommitted reservation exactly once. A database failed-claim trigger provides defense in depth and makes the refund independent of the Edge Function's error handling. `cla_recover_expired_learning_resource_claims(...)` uses a bounded `FOR UPDATE SKIP LOCKED` sweep; each canonical-generation invocation runs that recovery before admitting new work. A crashed process therefore cannot strand a teacher credit indefinitely.

The old Edge-level `getOrCreateWallet` / check-then-`spendCredit` path has been removed.

## Economic behavior

For the same authoritative curriculum need:

- `hit` -> certified database reuse -> zero new research/model generation and zero new credit;
- `pending` -> another request/candidate already owns the gap -> zero duplicate spend;
- `claimed` -> exactly one request may reserve one credit and proceed to external research/model generation.

For different simultaneous curriculum gaps, each gap must independently acquire a wallet-locked reservation before any external cost. Insufficient balance fails before Tavily/Groq. Failed or expired uncommitted work returns the reservation.

## Security posture

- platform roots use `created_by = null`, `owner_type = platform`;
- no teacher gains global creator-management authority by requesting a gap;
- `anon` has no canonical-version payload access;
- authenticated browser access is certified-only;
- service role has no version DELETE and no direct promotion UPDATE under the final authority;
- canonical reserve/refund/recovery RPCs are service-only;
- SHA-256 integrity is database-computed;
- reusable prompts exclude teacher name, school, class/stream, learner count, previous lessons, deadlines and teacher focus;
- generation/search cannot self-certify output;
- exact-version pins prevent contextual teaching records from silently drifting to a later canonical version.

## Certification contract

The repository workflow `.github/workflows/canonical-learning-assets-r3.yml` proves on a disposable Supabase instance:

- full migration-chain execution;
- deterministic identity convergence/privacy;
- RLS/grant/version/claim immutability contracts;
- promotion-authority adversarial contract;
- service-only atomic reserve/refund authority;
- crash-safe expired-claim recovery path;
- Deno type-check of `generate-canonical-lesson-plan`;
- authoritative lesson identity path;
- `recovery -> claim -> credit reserve -> research -> model -> candidate deposit` ordering;
- legacy check-then-spend wallet code is absent;
- reusable-prompt privacy boundary.

A certification run on head `92870de...` proved the complete migration chain, including both R3.6 migrations, could install on disposable Supabase. Its first post-install identity-test step then failed only because TypeScript 5.9 refuses command-line file compilation when a repository `tsconfig.json` is present unless `--ignoreConfig` is specified. The identity assertions themselves had not executed. The test harness was repaired without weakening any assertion by adding the compiler-required `--ignoreConfig` flag. A new exact-head certification cycle is required after this handover update.

Exact-head certification must be observed green before production commissioning and merge. If `main` advances after certification, reconcile again and rerun certification rather than merging a stale head.

## Production commissioning boundary

Production currently remains pre-R3. After exact-head repository certification succeeds, apply the R3 migrations in timestamp order, deploy `generate-canonical-lesson-plan` with JWT verification, run postflight privilege/RLS/version-pin/single-flight/credit-recovery checks and Supabase security/performance advisors, then merge only if production and repository evidence remain clean.

## Non-negotiables

- no fuzzy text matching masquerading as authoritative curriculum identity;
- no automatic certification of generated or legacy content;
- no parallel canonical root/question bank;
- preserve all newer `main` work during every reconciliation;
- no direct Vercel deployment during branch certification;
- no external generation cost without a claim-bound atomic credit reservation;
- no stranded credit after a failed or expired uncommitted claim;
- keep this handover synchronized with reconciliation, certification, production commissioning and final merge state.
