# Canonical Learning Assets R3.1 — Authority Reconciliation

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-20260818`
Base main: `98ee9c5391349fd60935f5b8abb4d5dff391c2e8`
Status: R3.1 authority decision complete; production unchanged

## Executive decision

Do **not** create a new `canonical_learning_assets` table.

Production already contains the correct generic reusable-resource root: `public.learning_resources`. It already has a globally unique `canonical_key`, curriculum and subject identity, source provenance pointers, owner/visibility semantics, and distribution/adoption relations. The Canonical Learning Asset programme therefore extends and hardens this authority instead of creating a parallel content identity plane.

The authoritative rule is now:

`learning_resources = canonical reusable resource identity/version root`

Operational lesson plans, homework, assessments, projects and assignments remain delivery/execution records and link to the reusable root.

## Production authority map

### Canonical reusable root — KEEP + EXTEND

`learning_resources`

Observed production contract:

- globally unique `canonical_key`;
- `source_type` currently supports publication, chapter, VibeLearn content, content block, teacher note, uploaded document and external resource;
- curriculum identity: `curriculum_id`, `sub_strand_id`, `subject_id`, grade/subject/strand labels and learning outcomes;
- origin pointers: `publication_id`, `chapter_id`, `content_id`, `content_block_id`;
- distribution semantics: `visibility`, `owner_type`, `school_id`;
- lifecycle today is only `active|inactive|archived`;
- creator is `created_by`;
- uniqueness already prevents duplicate canonical keys and duplicate wrappers for publication/chapter/content/content-block source identities;
- validation trigger `ce_validate_learning_resource` guards inserts/updates.

Missing for platform-wide certified reuse:

- explicit asset kind/purpose for lesson-plan, notes, homework, quiz, worksheet, rubric, etc.;
- immutable version lineage;
- candidate/verified/certified/retired certification lifecycle independent of ordinary active/inactive availability;
- certification evidence/policy identity;
- governed promotion authority;
- immutable certified-version protection;
- generalized provenance/rights evidence for non-publication resources;
- lookup/claim contract for concurrent cache misses;
- reuse/economic telemetry.

### Teacher adoption — KEEP + EXTEND

`teacher_resource_adoptions`

Current authority already records one teacher adopting one resource, with lifecycle and preferred role. This is the right teacher-level adoption plane.

Future additions may include exact local customization/fork metadata and last-used/reuse evidence, but teacher adoption must not mutate the canonical resource.

### School distribution — KEEP

`school_resource_library`

School-level approval/availability is distribution policy, not canonical content identity. It remains a child of `learning_resources`.

### Class distribution — KEEP

`class_resource_library`

Class/subject/teacher availability is contextual distribution. It remains separate from canonical content identity.

### Teaching occurrence links — KEEP + EXTEND

`teaching_resource_links`

This table already links `learning_resources` to:

- scheme lessons;
- lesson plans;
- homework;
- projects;
- exams;
- chapter assignments.

It therefore provides the existing bridge between reusable content and contextual delivery. R3 must extend target coverage only where required rather than add duplicate `*_canonical_asset_id` relationships everywhere.

### Scheme lesson resource links — KEEP / COMPATIBILITY PATH

`scheme_lesson_resource_links`

This is an older/specialized scheme/publication link that now also contains `resource_id`. It should remain for compatibility until the generic `teaching_resource_links` path fully covers scheme behavior. Do not create another scheme-content junction.

## Existing specialized authorities

### Assessments — KEEP

The platform already contains the newer unified assessment authority:

- `assessment_definitions`;
- `assessment_items`;
- `assessment_item_outcomes`;
- sections, assignments, attempts, responses, scoring and moderation tables.

`assessment_definitions.learning_resource_id` and `assessment_items.source_learning_resource_id` already bridge assessment structures to reusable resources. Quizzes/homework assessments should reuse this system rather than revive a second question authority.

### Legacy question-bank layer — DO NOT EXPAND

The repository contains the earlier migration `20260723074916_layer3_content_banks_and_pack_versioning.sql`, which created `assessment_questions` and `homework_question_bank` and described them as reusable banks. Later architecture introduced unified `assessment_definitions` / `assessment_items` and `learning_resources` integration.

Decision: do not build Canonical Learning Assets on the legacy parallel banks. Preserve compatibility where still required, but new quiz/homework canonicalization should use `learning_resources` + the unified assessment authority.

### Curriculum content — KEEP AS CURRICULUM/CONTEXT AUTHORITY

`curriculum_content` is not the generic reusable-resource root. It holds curriculum-grounded lesson context/parent briefs and already has its own version history. It may be a source/input to a canonical resource, not a replacement for `learning_resources`.

### Content blocks — KEEP AS PUBLICATION-GRANULAR CONTENT

`content_blocks` remains normalized chapter/publication content. `learning_resources.source_type='content_block'` already wraps one block into the reusable-resource plane when needed.

### Originality and rights — REUSE, THEN GENERALIZE

Existing authorities include:

- `content_originality_checks`, currently publication/chapter/block oriented;
- `curriculum_content_rights`, currently source/proposal oriented;
- Content Factory research and semantic-verifier evidence tables.

Decision: R3 must integrate with these evidence systems rather than invent a parallel verifier. Where the current schemas are publication/proposal-specific, add resource-level evidence links or a generalized provenance relation instead of copying their logic.

## Security findings

### S1 — creator-manageable global rows

Current `learning_resources_manage` RLS grants `ALL` to an authenticated user where `created_by = auth.uid()`.

That is acceptable for private creator resources, but unsafe for globally certified platform content: a teacher/creator must not be able to silently alter or delete a certified resource used by other teachers.

Required remediation:

- ordinary creator management remains allowed only for non-certified/non-platform resources;
- platform certification/promotion uses a separate governed authority;
- certified versions become immutable except for controlled retirement metadata/state transition;
- historical linked occurrences continue resolving the exact version they used.

### S2 — lifecycle conflation

`status = active|inactive|archived` represents availability, not evidence certification. Reusing it as a quality/certification state would mix two different concerns.

Required remediation: add a separate certification lifecycle.

### S3 — source types do not yet express generated educational artifacts

Current `source_type` distinguishes where a resource came from, not what educational artifact it is. Lesson plan, homework, quiz, worksheet and rubric therefore need a separate asset-kind dimension rather than overloading source provenance.

### S4 — current links use ON DELETE CASCADE in several distribution/teaching relations

This reinforces the requirement that certified global resources must not be ordinary-user deletable. Deleting a canonical resource could otherwise erase downstream relationship evidence.

### S5 — old public-role policies exist on specialized scheme links

`scheme_lesson_resource_links` policies are expressed to `public` rather than consistently `authenticated`. Existing predicates still constrain rows, but R3 should not copy this style into new policies. New/changed R3 policies will use explicit roles and least privilege.

## Identity decision

`learning_resources.canonical_key` remains the stable deterministic identity of the reusable resource represented by that row today.

R3.2 must introduce version semantics without breaking existing canonical keys. The preferred model is:

- stable family identity/key;
- immutable resource/version rows;
- one controlled current certified version per family;
- exact resource ID retained by historical delivery/adoption records.

The migration must preserve all existing rows and references. It must not reinterpret existing `canonical_key` values destructively.

## Lookup-before-generation decision

Generation surfaces must eventually resolve in this order:

1. derive normalized curriculum/content need;
2. resolve canonical family key;
3. find current certified `learning_resources` version;
4. if found, adopt/link it and skip model/search spend;
5. if missing, claim the gap once;
6. research/generate candidate through governed Content Factory/Worker Engine;
7. independently verify/certify;
8. publish a new immutable resource version;
9. link/adopt it into the requesting occurrence.

A teacher's class/date/name/learner count remains delivery personalization and must not define the global canonical educational asset.

## Product and business decision

The reusable-content moat is not a second content database. It is the strengthening of the already-connected resource graph into a certified, versioned, evidence-backed inventory.

That gives VibeSchool compounding economics:

- common requests become near-zero generation-cost cache hits;
- each genuine content gap can become reusable inventory after certification;
- teacher customization stays local;
- usage evidence identifies which canonical assets require improvement;
- schools and classes can adopt the same platform asset without copying ownership semantics.

## R3.2 implementation target

R3.2 should extend existing authorities with the smallest safe schema surface required for:

1. resource asset kind/purpose;
2. immutable family/version lineage;
3. certification lifecycle and evidence;
4. controlled promotion/retirement;
5. concurrency-safe canonical lookup/claim;
6. creator-write protection once certified;
7. explicit RLS/grants compatible with current Supabase Data API changes;
8. clean-rebuild verification and migration-security tests.

It must not change production in this branch phase.

## Supabase platform compatibility note

Supabase is moving existing projects toward explicit Data API grants, with enforcement for existing projects scheduled for 2026-10-30. R3 migrations must therefore declare grants explicitly alongside RLS rather than rely on legacy automatic exposure. Database functions default to broad execution privileges unless explicitly restricted, so any privileged promotion function must revoke `PUBLIC`/`anon` execution and use the narrowest role/authority possible.

## Handover log

### 2026-08-18 — R3.1 completed

- Inspected production Supabase columns, indexes, constraints, validation triggers and RLS for the reusable-resource graph.
- Confirmed `learning_resources.canonical_key` is already globally unique.
- Confirmed teacher, school and class adoption/library authorities already point to `learning_resources`.
- Confirmed `teaching_resource_links` already bridges reusable resources into lesson plans, homework, projects, exams and assignments.
- Confirmed specialized assessment structures already link back to `learning_resources`.
- Identified the creator-update/delete risk for future certified global assets.
- Identified lifecycle conflation and missing version/certification semantics.
- Rejected creation of a competing `canonical_learning_assets` table.
- Production Supabase unchanged.
- Vercel intentionally untouched.
- Next: R3.2 canonical version/certification hardening on this branch, followed by clean rebuild/security certification before any production promotion.