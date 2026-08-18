# Canonical Learning Assets — Handover Log

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-r3-20260818`
Current reconciliation base main: `e30a5d91bced3c5b5d3a83486aee8c3ab8ed97b4`
Production Supabase: unchanged
Vercel: intentionally untouched

## Mission

`curriculum need -> deterministic family identity -> certified lookup -> reuse hit OR unique governed content-gap claim -> research/generate -> independent verification -> certify immutable version -> adopt/pin delivery`

This applies to lesson plans, notes, homework, quizzes, exercises, revision, worksheets, assessments, worked examples, projects/practicals, remedial/enrichment resources, marking schemes, rubrics and reusable content blocks.

## Architectural authority

1. `learning_resources` is the canonical reusable family/root authority. Do not create `canonical_learning_assets`.
2. `learning_resource_versions` is the exact immutable reusable-content version authority.
3. `teaching_resource_links` remains the generic bridge from reusable resources to contextual teaching/delivery and receives an exact version pin.
4. Existing unified `assessment_definitions` / `assessment_items` remain assessment/question authority.
5. Teacher/school/class/learner/date/deadline state is contextual and must not enter global canonical identity or reusable candidate payloads.
6. Only independently certified versions are reusable across unrelated teachers/schools.
7. Model/search spend is permitted only after the canonical single-flight gate returns `claimed`.

## Current branch lineage

The earlier R3 history had fallen 12 commits behind while main advanced through Content Factory R2.3. The branch was rebuilt from exact current main `e30a5d91...` using only the intended R3 blobs.

Reconciliation commit:

`b81628e9803b4dd6b66a01c0451c7d4883f3f59b`

Immediately after reconciliation the branch compared as 0 commits behind main and 1 commit ahead.

## Completed R3.1/R3.2 authority

- `lib/content/canonicalLearningAssetIdentity.ts` — deterministic curriculum-addressable family identity.
- `lib/content/canonicalLearningAssetLookup.ts` — pure certified lookup-before-generation gate.
- `supabase/migrations/20260818141000_canonical_learning_resource_versions.sql` — additive root/version schema, RLS/grants, immutability, exact delivery pin and certified lookup RPC.
- `supabase/migrations/20260818141500_canonical_learning_resource_version_visibility_hardening.sql` — hides non-certified payloads from normal authenticated clients.
- `supabase/migrations/20260818141600_canonical_learning_resource_platform_visibility.sql` — integrates certified platform resources into existing learning-resource visibility authority.
- `supabase/migrations/20260818142000_canonical_learning_resource_generation_claims.sql` — atomic `hit|pending|claimed` single-flight claim authority with expiry/recovery.
- `supabase/migrations/20260818142100_canonical_learning_resource_candidate_deposit.sql` — candidate deposit, PostgreSQL SHA-256, and candidate/verified pending suppression.
- `scripts/test-canonical-learning-asset-identity.sh` — identity convergence/privacy contract.
- `scripts/sql/canonical_learning_resource_versions_verify.sql` — adversarial database contract.
- `docs/CANONICAL_LEARNING_ASSETS_R3_1_AUTHORITY_MAP.md` — production/repository authority reconciliation.
- `docs/CANONICAL_LEARNING_ASSETS_R3_2_SCHEMA_DESIGN.md` — finalized schema/security design.

## R3.3 governed generation boundary added

New repository-only components:

- `supabase/functions/generate-canonical-lesson-plan/index.ts`
- `lib/teaching/canonicalLessonGeneration.ts`
- `.github/workflows/canonical-learning-assets-r3.yml`

The canonical lesson generator requires stable UUID-backed curriculum identity:

- `curriculumId`
- `subjectId`
- `grade`
- `subStrandId`

Free-text topic/strand labels may enrich research and pedagogy but cannot establish identity.

Execution order is now encoded as:

`JWT -> authoritative identity validation -> cla_claim_learning_resource_gap -> hit/pending/claimed`

For `hit`:

`certified version -> immediate response -> zero research -> zero model -> zero new Vibe Credit spend`

For `pending`:

`existing active claim/candidate/verified version -> 202 pending -> zero duplicate spend`

For `claimed` only:

`wallet check -> Tavily enrichment -> context-free Groq generation -> PostgreSQL candidate deposit -> one credit spend`

The reusable prompt explicitly excludes teacher name, school, class/stream, learner count, previous lessons, deadlines and teacher focus.

A generated candidate is returned to the requesting teacher for immediate contextual use but is not globally reusable until certification.

## Security posture

- Platform canonical roots use `created_by = null`, `owner_type = platform`.
- Certified versions cannot be deleted.
- Certified payload/evidence cannot be edited.
- Retired versions preserve payload/evidence immutably.
- Candidate/unverified payloads are hidden from normal browser access.
- `anon` has no canonical-version access.
- Service role does not receive version DELETE.
- Candidate SHA-256 is computed inside PostgreSQL.
- Generation/search cannot self-certify output.
- The canonical generator uses the service-role database boundary only after validating the caller JWT.

## Confirmed application gap still fail-closed

Current `lib/teaching/lessonWorkspace.ts` explicitly removes `grade` before returning workspace context.

Current `components/teacher/LessonPlanModal.tsx` passes only strand/sub-strand names into the legacy generator. It does not yet pass `curriculumId`, `subjectId`, `grade`, and `subStrandId` into the canonical generator.

This caller must be patched before the canonical generator replaces the legacy lesson-plan path. Do not resolve this gap with title/topic/strand fuzzy matching.

The safe next wiring is:

`Lesson Workspace authoritative source -> preserve grade -> stable curriculum/sub-strand IDs -> generateCanonicalLessonPlan -> hit/pending/candidate -> save contextual teacher occurrence -> exact learning_resource_version pin`

Scheme rows with no authoritative `curriculum_id` or no resolvable stable curriculum/sub-strand identity must fail closed for canonical generation.

## Certification state

Repository CI contract is now defined to prove:

- clean disposable Supabase migration execution;
- deterministic family identity tests;
- adversarial RLS/immutability/version/claim SQL contract;
- Deno type-check of canonical generator;
- claim-before-wallet/research/model/deposit ordering;
- reusable-prompt privacy boundary.

These checks have not yet been observed green on the new exact-head commit. Therefore R3 is not merge-certified yet.

## Production boundary

Production Supabase remains unchanged. The live project was inspected read-only and still has the pre-R3 `fn_learning_resource_visible()` authority while R3 tables/RPCs remain absent, as expected.

No R3 migration or Edge Function has been deployed to production.

## Non-negotiables

- Production Supabase stays unchanged until exact-head database certification passes.
- No Vercel action until application work is complete and intentionally promoted.
- No title/free-text matching masquerading as canonical curriculum identity.
- No automatic certification of generated or legacy content.
- No parallel canonical root/question bank.
- Keep this handover updated after every reconciliation/certification/promotion step.
