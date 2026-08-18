# VibeSchool Canonical Learning Asset System

Date: 2026-08-18
Status: Architecture baseline / implementation authority
Branch: `feature/canonical-learning-assets-20260818`
Base: exact `main` commit `98ee9c5391349fd60935f5b8abb4d5dff391c2e8`

## Mission

VibeSchool must not repeatedly generate equivalent educational content for every teacher, class, school, or learner. A high-quality educational asset should be created or acquired once, verified, certified, versioned, and reused wherever the same curriculum need occurs. Teacher/class delivery remains contextual and private.

The governing rule is:

`curriculum need -> canonical lookup -> reuse certified asset when available -> generate/research only on a genuine gap -> verify -> certify -> retain as reusable VibeSchool inventory`

This system generalizes the earlier lesson-plan reuse idea across VibeSchool content.

## Covered asset types

The canonical layer is designed for reusable educational assets including:

- lesson plans;
- teacher notes;
- learner notes;
- homework;
- quizzes;
- exercises and practice sets;
- revision tasks;
- worksheets;
- formative assessments;
- question-bank items;
- worked examples;
- projects and practical activities;
- remedial activities;
- enrichment activities;
- marking schemes;
- rubrics;
- reusable textbook/content blocks.

Additional asset types may be added only when they satisfy the same identity, provenance, certification, versioning and privacy rules.

## Non-goals / content that must remain contextual

The global canonical layer must not absorb operational or personal data merely because it is associated with educational content. The following remain teacher, learner, class or school scoped:

- learner attempts and submissions;
- marks and results;
- teacher reflections;
- classroom incidents;
- learner-specific interventions;
- confidential accommodations;
- private teacher notes;
- school-sensitive information;
- assignment deadlines and delivery state;
- attendance/evidence records;
- parent communication state.

## Architectural separation

### 1. Canonical educational asset

A canonical asset expresses reusable educational substance independent of a particular teacher occurrence.

Proposed conceptual authority:

`canonical_learning_assets`

Minimum identity and governance fields:

- `id`
- `asset_type`
- curriculum authority/version
- grade/form/stage
- subject
- strand/sub-strand/topic where applicable
- learning outcome / curriculum objective where available
- purpose (teach, practise, assess, revise, remediate, enrich)
- language
- difficulty or level where meaningful
- deterministic `canonical_key`
- title
- structured content/body reference
- version
- lifecycle status (`candidate`, `verified`, `certified`, `retired`)
- provenance
- rights basis / license state
- creator/origin metadata
- certification evidence
- timestamps

The exact schema must reconcile with existing curriculum, Content Factory, assessment and publication authorities before migration design is finalized. Do not create duplicate authorities when VibeSchool already has a canonical table for a concept.

### 2. Adoption / delivery occurrence

Teacher-facing operational records remain separate. Existing lesson plans, homework, assessments and other execution tables should reference the canonical asset/version they adopted rather than becoming global themselves.

Conceptually an adoption records:

- canonical asset id;
- canonical version used;
- teacher/school/class delivery identity as applicable;
- local overrides;
- adoption time;
- occurrence/delivery identity.

Historical delivery must continue to resolve the exact version that was used even after a newer canonical version is certified.

## Deterministic canonical identity

Reuse must not depend on free-text title matching.

Canonical identity should be derived from normalized authoritative dimensions such as:

`country + curriculum/version + grade/form + subject + strand/sub-strand/outcome + asset_type + purpose + language + material variant dimensions`

Example conceptual keys:

`kenya|cbc-vX|grade6|mathematics|fractions|add-unlike-fractions|lesson_plan|teach|en`

`kenya|cbc-vX|grade6|mathematics|fractions|add-unlike-fractions|quiz|formative|en`

The final key algorithm must use stable IDs where possible, normalize equivalent values, be versioned itself, and have a uniqueness/concurrency strategy so simultaneous requests cannot create duplicate canonical assets.

## Lookup-before-generation contract

Every content-producing surface must eventually follow this decision order:

1. Resolve authoritative curriculum/material identity.
2. Build or resolve the canonical content identity.
3. Query the certified canonical inventory.
4. If an appropriate certified asset exists, adopt/reuse it.
5. If no appropriate asset exists, create a candidate production job.
6. Research/generate the candidate using the governed Content Factory/Worker Engine path.
7. Verify curriculum, factual/semantic quality, provenance and rights.
8. Certify only after all required gates pass.
9. Persist/version the canonical asset.
10. Adopt it into the requesting teacher/class occurrence.

AI/model generation is therefore a cache-miss/content-gap producer, not the default delivery mechanism.

## Personalization contract

Canonical content must exclude teacher/class private context by default. Teacher name, school name, learner names, class-specific performance, confidential accommodations and reflections are not part of global canonical content.

Personalization happens after adoption through local overrides or a derived contextual representation.

A teacher editing an adopted asset must never mutate the certified canonical version directly.

Supported conceptual actions:

- **Use as-is**: retain canonical content unchanged for the occurrence.
- **Customize locally**: create local overrides/fork state owned by the teacher/context.
- **Suggest improvement**: submit a contribution candidate to Content Factory; it does not alter the canonical asset until independently reviewed and certified.

## Versioning contract

Canonical assets are immutable by version after certification.

Example:

`asset A v1 certified -> v2 candidate -> v2 certified -> new adoptions default to v2`

Historical teacher occurrences that used v1 continue to reference v1. Corrections requiring emergency retirement must preserve audit history while preventing new automatic adoption.

## Certification and quality gates

The first generated output must never automatically become platform-wide content.

Required lifecycle:

`candidate -> evidence/research -> curriculum verification -> factual/semantic verification -> provenance/rights check -> quality gate -> certified`

Only `certified` assets may be automatically reused across unrelated teachers/schools.

This should integrate with the existing Content Factory research and semantic-verification architecture rather than create a parallel verification plane.

## Rights and provenance

VibeSchool must not equate possession of a database row with ownership of underlying intellectual property.

Each canonical asset must preserve enough evidence to answer:

- Who or what created it?
- Which source materials support it?
- Was model generation involved?
- Which curriculum authority/outcome does it implement?
- What rights/license/basis permit VibeSchool to store, adapt, distribute and reuse it?
- Which parts are original VibeSchool expression versus externally sourced facts/material?
- Who/what certified it and under which policy/version?

Teacher private edits do not automatically become canonical VibeSchool property. Contributions must enter an explicit contribution/review/rights path before platform promotion.

## Assessment specialization

Quizzes, homework and assessments require structure beyond a generic body blob. The canonical parent asset should link to existing assessment/question authorities wherever possible, preserving independently addressable:

- questions/items;
- options;
- expected answers;
- marks/weights;
- rubrics;
- learning-outcome mappings;
- difficulty/skill metadata;
- randomized/presentation rules where applicable.

Do not create a duplicate question bank if an existing certified assessment authority can be extended or referenced.

## Reuse telemetry

The system should eventually record adoption/reuse evidence without leaking learner private data into the canonical object. Useful measures include:

- adoption count;
- unique school/teacher counts where privacy rules allow aggregate reporting;
- asset/version usage;
- local-edit/fork rate;
- rejection/abandonment rate;
- improvement suggestions;
- assessment effectiveness signals only through appropriately governed aggregates;
- generation avoided / estimated model cost avoided;
- stale/retired asset usage prevention.

These metrics feed Content Factory prioritization. High edit/rejection rates should create evidence for review, not automatically rewrite canonical content.

## Product behavior

The ideal teacher experience is simple:

`Prepare content -> VibeSchool resolves curriculum need -> best certified asset is reused -> contextual delivery copy is ready`

The teacher should not need to know whether an asset was first created minutes ago or has safely served thousands of equivalent curriculum occurrences.

## Business consequence

Canonical reuse turns content production spend into compounding inventory. Each legitimate content gap filled can increase VibeSchool's reusable educational asset base instead of causing repeated generation spend. The moat is not merely a pile of generated text; it is a curriculum-addressable, evidence-backed, rights-aware, versioned, usage-informed and continuously verified learning asset system.

## Security / authorization principles

- Canonical certification/promotion is privileged; ordinary teachers cannot directly certify global content.
- Teachers may read only canonical assets appropriate to product access rules.
- Teacher/class operational data remains protected by its own RLS/authorization domain.
- Canonical tables in an exposed schema require explicit grants plus RLS; privileged promotion RPCs must have explicit EXECUTE grants and safe function configuration.
- Service-role credentials must never be exposed to browser clients.
- Contribution paths must not permit a teacher to overwrite global certified content.
- Retrieval must fail closed when curriculum identity or authorization is ambiguous.

## Implementation programme

### R3.1 — Repository/production authority reconciliation

Inventory current lesson, notes, homework, assessment, curriculum, Content Factory, publication and rights/provenance authorities in GitHub and production Supabase. Produce an authority map and identify duplicate/legacy semantics before schema changes.

### R3.2 — Canonical identity + asset/version schema

Implement deterministic identity, canonical asset/version lifecycle, provenance/rights fields, explicit grants/RLS and concurrency-safe uniqueness. Include clean rebuild and migration-security verification.

### R3.3 — Lesson-plan adoption pilot

Refactor lesson generation to resolve canonical content before model generation. Keep `lesson_plans` as occurrence records and attach canonical asset/version identity. Separate reusable educational content from teacher/school/class personalization.

### R3.4 — Notes and homework

Route notes and homework through the same canonical authority while preserving delivery/deadline/submission state in operational tables.

### R3.5 — Quiz/assessment integration

Reconcile canonical assets with existing assessment definitions/items/outcome mappings. Avoid parallel question-bank authority.

### R3.6 — Contribution/fork/version workflow

Implement use-as-is, local customization and governed improvement proposals. Preserve immutable historical versions.

### R3.7 — Content Factory certification integration

Connect candidate creation, Research Worker, Semantic Verifier and later editorial/rights gates to canonical promotion. No worker may self-certify its own research/generation output.

### R3.8 — Reuse analytics and economic controls

Measure hit rate, avoided generation, quality signals, version adoption and review triggers. Use evidence to prioritize Content Factory work.

## Acceptance invariants

The programme is not complete until automated tests prove at least:

1. Equivalent curriculum requests converge on one canonical identity.
2. Concurrent misses cannot create duplicate certified canonical assets.
3. Certified hits bypass external generation/research spend.
4. Candidate/unverified assets cannot be automatically reused platform-wide.
5. Teacher customization cannot mutate canonical content.
6. Teacher/class private data cannot enter canonical content through the normal adoption path.
7. Historical occurrences retain the exact canonical version used.
8. Retired versions are not selected for new automatic adoption.
9. Rights/provenance requirements fail closed where required.
10. Assessment items retain correct answer/rubric/outcome authority.
11. RLS/grants prevent ordinary users from promoting global content.
12. Repository migrations reproduce the complete canonical-content authority from a clean database.
13. Production promotion is separately controlled and is not implied by merge.

## Deployment discipline

This programme begins on an isolated branch from exact current `main`.

No production Supabase migration, Edge Function deployment, Worker Engine authority activation, or intentional Vercel invocation is authorized merely by creating this architecture document. Implementation must be certified on the branch first. Vercel should remain untouched until the work genuinely requires final application promotion.

## Handover log

### 2026-08-18 — Programme opened

- Confirmed current lesson-plan architecture is teacher/occurrence scoped and generation is performed before reusable canonical lookup exists.
- Generalized lesson-plan reuse into a Canonical Learning Asset System covering lessons, notes, homework, quizzes, assessments and other reusable learning content.
- Created branch `feature/canonical-learning-assets-20260818` from exact current `main` commit `98ee9c5391349fd60935f5b8abb4d5dff391c2e8`.
- Established lookup-before-generation, immutable versioning, local customization, certification, provenance/rights, privacy and reuse telemetry contracts.
- Production Supabase unchanged.
- Vercel intentionally not triggered.
- Next controlled task: R3.1 repository/production authority reconciliation before any schema implementation.