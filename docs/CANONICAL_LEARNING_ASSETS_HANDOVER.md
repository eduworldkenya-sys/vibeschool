# Canonical Learning Assets — Handover Log

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-20260818`
Production Supabase: unchanged
Vercel: intentionally untouched

## Mission

Turn repeated teacher content requests into a governed reusable VibeSchool inventory:

`curriculum need -> certified lookup -> reuse hit OR single governed content-gap production -> verify -> certify -> version -> adopt`

Covered content includes lesson plans, notes, homework, quizzes, exercises, revision, worksheets, assessments, worked examples, projects/practicals, remedial/enrichment resources, marking schemes, rubrics and reusable content blocks.

## Completed work

### 1. Programme architecture

File: `docs/CANONICAL_LEARNING_ASSET_SYSTEM.md`

Opened the programme and established privacy, rights, versioning, lookup-before-generation, customization and certification principles.

### 2. R3.1 production/repository authority reconciliation

File: `docs/CANONICAL_LEARNING_ASSETS_R3_1_AUTHORITY_MAP.md`
Commit: `5aec7f619d3e30ac7e43147856c866aa9d94ef3f`

Key decision: **do not create a new `canonical_learning_assets` table**.

Production already contains the correct reusable-resource root: `learning_resources`. It has a globally unique `canonical_key`, source/curriculum identity and existing relationships to teacher/school/class adoption and teaching delivery.

Existing graph confirmed:

```text
learning_resources
  |-- teacher_resource_adoptions
  |-- school_resource_library
  |-- class_resource_library
  |-- teaching_resource_links
  |     |-- scheme lesson
  |     |-- lesson plan
  |     |-- homework
  |     |-- project
  |     |-- exam
  |     `-- chapter assignment
  `-- scheme_lesson_resource_links (specialized compatibility path)
```

Assessment structures already connect to this root through `assessment_definitions.learning_resource_id` and `assessment_items.source_learning_resource_id`.

### 3. Security/governance defect identified

Current `learning_resources_manage` RLS allows an authenticated creator to manage rows where `created_by = auth.uid()`.

This is acceptable for private creator resources but not for a platform-certified resource used globally. Certified versions therefore require a separate immutable system-managed authority. Ordinary creators must never be able to alter/delete the globally certified payload that historical occurrences depend on.

### 4. Supabase 2026 security compatibility incorporated

Current Supabase guidance/changelog requires R3 to treat explicit Data API grants and RLS as one migration contract. New functions must not rely on broad default EXECUTE privileges. Any privileged function must use the narrowest access model and explicit revocations/grants.

### 5. Deterministic canonical identity implemented

File: `lib/content/canonicalLearningAssetIdentity.ts`
Commit: `12ccfa7680fe4ff4a8d19e4a256ea8ce20baa54d`

Contract properties:

- jurisdiction/curriculum/grade/subject curriculum authority;
- strand/outcome/authority-backed topic anchor;
- asset kind;
- purpose;
- language;
- legitimate reusable material variant;
- deterministic normalization;
- outcome-order independence;
- fail-closed weak identity;
- no teacher/school/class/learner/date/deadline/delivery inputs.

This prevents contextual delivery data from fragmenting global reusable identity.

### 6. Identity verification script added

File: `scripts/test-canonical-learning-asset-identity.sh`
Commit: `c45ec9cef6c63c7e05c1fcb896597358959adf89`

It compiles the identity module and asserts convergence, non-collision, weak-identity rejection and absence of forbidden delivery fields.

### 7. R3.2 exact-version architecture defined

File: `docs/CANONICAL_LEARNING_ASSETS_R3_2_SCHEMA_DESIGN.md`
Commit: `be7b13aa836ab39ed39872db77cd76f1db4db6e6`

Core decision:

`learning_resources = stable family/root`

`learning_resource_versions = exact immutable content/certification version`

This preserves all current roots/FKs and lets historical occurrences pin the exact certified version used.

Planned version states: `candidate`, `verified`, `certified`, `retired`, `rejected`.

The first generated result is never globally reusable until certified.

### 8. Pure lookup-before-generation gate implemented

File: `lib/content/canonicalLearningAssetLookup.ts`
Commit: `7e8a7bb87dd91cdf7df99458f1f07baeec708a74`

Behavior:

- builds deterministic family identity;
- asks a storage adapter only for a currently certified version;
- `hit` sets `generationAllowed: false`;
- `miss` sets `generationAllowed: true`;
- mismatched store result fails closed;
- module has no Groq/Tavily/Vibe Credits/teacher/school/class dependencies.

It is intentionally storage-agnostic until the version schema exists.

## Important architecture corrections

The initial programme document used `canonical_learning_assets` as a conceptual placeholder before R3.1. R3.1 supersedes that placeholder. The production/root authority is `learning_resources`; no competing root table should be created.

## Migration tooling constraint

The current execution environment cannot run the local Supabase CLI. The Supabase skill requires migrations to be instantiated through the supported migration workflow instead of inventing filenames. A hosted Supabase development branch also requires an explicit platform cost-confirmation workflow.

Therefore:

- no migration timestamp has been fabricated;
- no DDL has been written into an invented migration file;
- production has not been mutated to work around the limitation;
- implementation-safe pure contracts have continued on GitHub.

When an official migration environment is available, instantiate R3.2 from `CANONICAL_LEARNING_ASSETS_R3_2_SCHEMA_DESIGN.md`, then run clean rebuild/security tests before any production promotion.

## Next execution sequence

1. Instantiate official R3.2 migration through supported Supabase migration tooling.
2. Add `learning_resource_versions`, root asset-kind/purpose identity, exact-version pins and least-privilege RLS/grants.
3. Add concurrency-safe `hit|pending|claimed` content-gap claim operation.
4. Implement Supabase store adapter for `CanonicalLearningAssetStore`.
5. Wire lesson-plan flow so certified lookup occurs **before** Vibe Credit check, Tavily search and Groq call.
6. On hit, materialize/adopt teacher occurrence without external generation spend.
7. On miss, claim once; only the claimant may spend on research/generation.
8. Route candidate through Content Factory Research Worker + Semantic Verifier + rights/quality gate.
9. Certify exact version; subsequent equivalent requests become hits.
10. Extend same path to notes/homework, then unified quiz/assessment structures.

## Non-negotiable invariants

- no teacher private data in canonical payload identity;
- no automatic certification of legacy/AI content;
- no direct creator mutation of certified versions;
- no duplicate canonical root for the same family key;
- no duplicate simultaneous generation for one family;
- no model/search spend before miss claim;
- no new parallel question bank;
- no production promotion merely because branch code exists;
- no Vercel invocation until application work is complete and intentionally promoted.
