# Canonical Learning Assets R3.2 — Schema Design

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-20260818`
Status: Implementation-ready design; official migration not yet instantiated

## Decision

Preserve `public.learning_resources` as the stable reusable-resource **root/family identity**. Do not reinterpret or duplicate its globally unique `canonical_key`.

Add an immutable child-version authority for canonical educational substance:

`learning_resources (stable identity) -> learning_resource_versions (exact immutable content/certification version)`

This is safer than putting mutable version fields directly on the root because existing publication/chapter/content wrappers and all current FKs continue to mean what they mean today.

## Why this shape

A stable root solves deduplication and discovery. An immutable version solves history and certification.

Example:

```text
learning_resources
  canonical_key = cla:v1|...|kind=lesson_plan|...
  asset_kind = lesson_plan
        |
        +-- version 1  retired   payload/hash A
        +-- version 2  certified payload/hash B  <- default for new adoption
        +-- version 3  candidate payload/hash C  <- not reusable yet
```

Teacher A may have taught version 1. Teacher B may receive version 2 today. Version 3 can be under review without affecting either teacher.

## Root additions

R3.2 should add only reusable-identity semantics to `learning_resources`:

- `asset_kind text null` — educational artifact type, separate from source provenance;
- `purpose text null` — teach/practise/assess/revise/remediate/enrich/reference;
- `identity_key_version integer null` — deterministic family-key algorithm version;
- optional normalized language/variant fields if required for indexed lookup.

Existing rows remain valid with null R3 fields. No existing row is silently promoted to certified canonical content.

### Asset kinds

Initial controlled vocabulary:

- `lesson_plan`
- `teacher_notes`
- `learner_notes`
- `homework`
- `quiz`
- `exercise`
- `revision`
- `worksheet`
- `assessment`
- `worked_example`
- `project`
- `practical`
- `remedial`
- `enrichment`
- `marking_scheme`
- `rubric`
- `content_block`

This describes **what the educational object is**. Existing `source_type` continues to describe **where it came from**. Do not overload one with the other.

## New exact-version authority

Proposed table: `public.learning_resource_versions`.

Required fields:

- `id uuid primary key`;
- `resource_id uuid not null references learning_resources(id) on delete restrict`;
- `version integer not null check (version > 0)`;
- `previous_version_id uuid null references learning_resource_versions(id) on delete restrict`;
- `lifecycle_status text not null`;
- `payload_format text not null`;
- `payload jsonb not null`;
- `content_sha256 text not null`;
- `provenance jsonb not null default '{}'`;
- `rights_status text not null`;
- `certification_policy_version text null`;
- `certification_evidence jsonb not null default '{}'`;
- `created_by uuid null references profiles(id) on delete set null`;
- `created_at timestamptz not null default now()`;
- `verified_at timestamptz null`;
- `certified_at timestamptz null`;
- `retired_at timestamptz null`.

### Lifecycle

Initial controlled states:

- `candidate`
- `verified`
- `certified`
- `retired`
- `rejected`

The first generated result is a `candidate`, never a certified global asset.

### Uniqueness

Required constraints/indexes:

- unique `(resource_id, version)`;
- only one current `certified` version per resource root;
- at most one in-flight candidate/verified version for a root unless an explicitly versioned editorial workflow later requires parallel proposals;
- `previous_version_id` must belong to the same `resource_id` and have a lower version number; enforce with a trigger/function because a simple FK cannot express this relationship.

## Content hash

`content_sha256` is the immutable fingerprint of the canonical payload envelope. The database should compute/verify it rather than trust a browser-supplied hash.

For `jsonb`, hash a deterministic database representation of the stored payload. The migration implementation must use the project's installed cryptographic extension/function convention and must verify clean rebuild behavior before merge.

The hash is not a copyright proof. It is mutation/replay evidence.

## Version payload contract

`payload` is an asset-specific canonical envelope, not a dumping ground for contextual data.

### Lesson plan example

Payload contains reusable teaching substance such as objectives, resources, introduction, development, consolidation, formative assessment, homework content and differentiation patterns.

It must not contain teacher name, school name, class identity, timetable slot, taught date, learner names, private reflections or learner-specific evidence.

### Assessment/quiz example

Do not duplicate questions/answers already governed by `assessment_definitions` and `assessment_items`. The version payload should reference the exact approved assessment definition/version identity and presentation contract. The unified assessment tables remain question/mark/rubric authority.

## Exact-version pinning

Existing root links remain useful for discovery/distribution. Exact delivery history requires optional version pins.

R3.2/R3.3 should add nullable `resource_version_id` FKs where an exact delivered version matters, beginning with:

- `teaching_resource_links`;
- `teacher_resource_adoptions` only if adoption must pin rather than track the root;
- specialized occurrence records only where the generic teaching link cannot represent the version reliably.

Preferred rule:

- adoption/library records may point to the stable root;
- actual teaching/assignment occurrence pins `learning_resource_versions.id`.

That minimizes duplication while preserving audit history.

## Immutability and creator safety

`learning_resource_versions` must **not** inherit the current creator-manageable `learning_resources` write policy.

Authenticated browser roles should not receive direct INSERT/UPDATE/DELETE on certified-version authority.

Recommended access:

- authenticated: SELECT only when parent `learning_resources` is visible through existing visibility rules;
- candidate/promotion writes: server/governed worker path only;
- certification: separate privileged operation with evidence checks;
- delete: forbidden for canonical versions; use lifecycle retirement/rejection instead.

Once a version reaches `certified`, its payload, hash, provenance and certification evidence are immutable. Supersession creates a new version and retires the previous certified version atomically.

## Promotion authority

Do not use a browser-callable unrestricted `SECURITY DEFINER` function.

Promotion should be one of:

1. a service-only database operation invoked by the governed Content Factory/Worker Engine; or
2. a narrow function in a non-exposed/private schema with explicit caller checks and explicit EXECUTE grants only where required.

If a `SECURITY DEFINER` function is necessary, it must use an empty/fixed `search_path`, schema-qualified relations, explicit revocation from `PUBLIC`/`anon`, bounded input validation and immutable audit evidence.

## Certification evidence

Certification must be evidence-backed. At minimum the promoted version must be able to prove:

- curriculum identity resolved;
- semantic/factual verification passed;
- source/material provenance retained;
- required rights/originality gate passed or was explicitly not applicable under policy;
- verifier and policy versions recorded;
- no same-worker self-certification path.

Existing Content Factory Research Worker and Semantic Verifier evidence should be referenced/reused. Publication-specific originality/rights tables should be generalized by resource-level linkage where necessary instead of reimplemented.

## Lookup contract

The lookup service uses the pure identity builder in `lib/content/canonicalLearningAssetIdentity.ts`.

Flow:

1. Build deterministic family key.
2. Resolve `learning_resources.canonical_key = familyKey`.
3. Join/select its current certified `learning_resource_versions` row.
4. Validate visibility/entitlement.
5. Return exact version and payload.
6. If no root/version exists, return a typed miss; do not silently select an unverified candidate.

## Concurrency-safe miss contract

Two teachers requesting the same unseen lesson at the same moment must not generate two canonical candidates.

The database claim operation should:

1. upsert/resolve the root by unique `canonical_key`;
2. lock or atomically test that resource root;
3. return `hit` when a certified version exists;
4. return `pending` when another candidate/verified version already exists;
5. create exactly one candidate version/job and return `claimed` otherwise.

External model/search spend must happen **after** a successful `claimed` result, never before.

## Source provenance compatibility

Current `learning_resources.source_type` does not include a generated/canonical artifact source. R3 migration must decide whether to add values such as:

- `platform_generated`
- `platform_authored`
- `assessment_definition`

without breaking the existing target-contract check.

For versioned payloads, source provenance belongs primarily to version evidence. The root source type should remain a coarse origin category.

## RLS and grants

Supabase's 2026 Data API transition requires explicit access grants to be treated as part of the migration contract. New R3 tables/functions must not depend on old automatic grants.

Minimum posture:

- enable RLS on every new public table;
- revoke unintended privileges first;
- grant only required SELECT/EXECUTE operations;
- use `TO authenticated` explicitly in policies;
- never grant browser roles direct certification/promotion authority;
- test `anon`, unrelated authenticated user, creator, teacher adopter and privileged server paths.

## Migration/backfill safety

R3.2 migration must be additive and preserve all production rows.

Rules:

- no existing `learning_resources` row is automatically certified;
- no destructive rewrite of `canonical_key`;
- no mandatory version backfill for all legacy resources in the first migration;
- existing FKs continue working;
- new version pins are nullable during transition;
- schema must rebuild from a clean database using tracked migrations.

## Required verification

Before promotion, automated SQL tests must prove:

1. duplicate root canonical keys are impossible;
2. duplicate `(resource_id, version)` is impossible;
3. two certified versions cannot coexist for one root;
4. browser creator cannot mutate a certified version;
5. browser creator cannot delete a certified version;
6. unrelated users cannot read invisible parent resources through the version table;
7. visible-resource readers can read the certified version;
8. candidate versions are never returned by certified lookup;
9. previous-version lineage cannot cross resource roots;
10. exact version pins survive later supersession;
11. malformed/weak canonical identity is rejected before lookup;
12. explicit grants/RLS match intended Data API exposure.

## Tooling note

The current execution environment cannot run the local Supabase CLI, and creation of a hosted Supabase development branch requires the platform's explicit cost-confirmation workflow. Therefore this document deliberately does **not** invent a migration timestamp or mutate production to obtain one. The official migration file must be instantiated through the supported migration workflow before DDL is committed as a migration.

This constraint does not block pure identity/application contracts or design verification work on the GitHub branch.

## Handover

- R3.1 selected `learning_resources` as the existing canonical root.
- R3.2 deterministic family identity contract is committed.
- R3.2 exact-version/certification schema is specified here.
- Production Supabase remains unchanged.
- Vercel remains untouched.
- Next executable work: certified lookup service contract and non-spending cache-hit path, followed by official migration instantiation when a supported migration environment is available.