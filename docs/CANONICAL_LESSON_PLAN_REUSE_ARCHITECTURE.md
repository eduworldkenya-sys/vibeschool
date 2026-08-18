# Canonical Lesson Plan Reuse Architecture

Status: design authority for implementation
Date: 2026-08-18
Branch: `feature/canonical-lesson-plan-reuse-20260818`

## Mission

Generate or author a strong curriculum-grounded lesson plan once, certify it as a reusable VibeSchool asset, and let every eligible teacher adopt that same canonical version without paying or generating again unless a materially different lesson is required.

Teacher-specific delivery data remains private and editable. Canonical educational content remains immutable/versioned and is owned and governed by VibeSchool.

## Core rule

A lesson has two identities:

1. **Canonical lesson asset** — curriculum-grounded, reusable, versioned, system-owned.
2. **Teacher lesson occurrence** — teacher/class/timetable/date-specific adoption of a canonical asset, editable without mutating the canonical source.

`lesson_plans` remains the teacher occurrence/delivery record. It must not become the global content bank.

## Canonical identity key

Reuse must never match on free text such as teacher name, school name, or class label.

A canonical lesson identity should be derived from authoritative curriculum identity and pedagogical parameters, for example:

- curriculum_id / curriculum version
- subject_id
- grade/form/stage identity
- strand_id / sub-strand or learning outcome IDs
- lesson topic/focus normalized
- duration band
- language
- pedagogical template/version

The system computes a deterministic `canonical_key` (SHA-256 of normalized identity JSON). A unique constraint prevents duplicate canonical assets for the same versioned identity.

## Proposed data model

### canonical_lesson_assets

- id uuid PK
- canonical_key text unique not null
- curriculum_id uuid
- subject_id uuid not null
- strand_id uuid
- learning_outcome_ids uuid[]
- grade_level text
- topic text not null
- normalized_focus text
- duration_minutes int
- language text default 'en'
- title text not null
- body text not null
- structured_sections jsonb not null
- status text: candidate | certified | retired | superseded
- ownership text default 'vibeschool'
- license text / rights_basis text
- created_from_teacher_plan_id uuid nullable
- created_by uuid nullable (provenance only; not ownership)
- generation_method text: ai | human | imported | hybrid
- generator_version text
- curriculum_version text
- quality_score numeric
- certification_evidence jsonb
- version int not null
- supersedes_asset_id uuid nullable
- created_at / certified_at / updated_at

### teacher_lesson_adoptions

- id uuid PK
- canonical_lesson_asset_id uuid not null
- lesson_plan_id uuid not null unique
- teacher_id uuid not null
- school_id uuid
- adopted_version int not null
- adoption_mode text: exact | customized
- customization_summary jsonb
- adopted_at timestamptz

A teacher plan stores its own copy of editable fields for stable historical delivery. Editing it never changes the canonical asset.

## Runtime flow

1. Teacher selects a curriculum lesson / scheme item / timetable occurrence.
2. System computes the canonical identity key.
3. **Lookup first.** Search certified canonical_lesson_assets.
4. If a certified match exists:
   - return it immediately;
   - do not call Tavily/Groq;
   - do not spend a Vibe Credit for generation;
   - instantiate/adopt it into the teacher's `lesson_plans` occurrence.
5. If no certified match exists:
   - acquire a per-key generation lock/idempotency guard;
   - one request becomes the producer;
   - other concurrent requests wait/re-read rather than generating duplicates;
   - produce a candidate lesson;
   - validate curriculum identity, format, safety, originality/rights and quality;
   - certify/promote when gates pass;
   - store canonical asset;
   - instantiate teacher occurrence.
6. Subsequent teachers receive the certified asset.

## Personalization rule

Teacher-specific fields must not contaminate the canonical source. Keep these in the teacher occurrence or runtime overlay:

- teacher name
- school name
- exact class/stream name
- learner count
- timetable slot/date
- local resources available
- teacher notes
- accommodations/differentiation for known learners
- reflections and evidence
- homework assignment IDs

The canonical lesson may contain generic differentiation guidance, but learner-specific or school-specific data must remain outside the shared asset.

## Ownership and rights

VibeSchool should distinguish **platform ownership** from **source provenance**.

- AI-generated/original VibeSchool educational expression may be recorded as a VibeSchool-owned asset subject to applicable provider terms and law.
- Teacher edits remain attributable to the teacher; do not silently appropriate substantial teacher-authored additions into the global canonical asset.
- Teacher-created improvements should enter a contribution/review workflow before becoming a new canonical version.
- Third-party or KICD-derived facts/structure retain source provenance; VibeSchool owns its original expression, transformation, metadata, software and compilation only to the extent legally available.
- Store rights_basis, source evidence, generation method, originality checks and certification evidence.

## Versioning

Canonical assets are immutable after certification except metadata corrections that do not change educational meaning.

Material improvements create version N+1 with `supersedes_asset_id`. Existing teacher occurrences remain pinned to the version they adopted, preserving auditability.

New teachers receive the current certified version by default.

## Quality gate

Never make the first generated response globally reusable merely because it exists.

Candidate -> certified requires deterministic gates where possible:

- authoritative curriculum identity match
- required section completeness
- factual/semantic verifier pass
- originality/rights evidence
- age/stage appropriateness
- no teacher/student PII
- no school-specific contamination
- structured parser success
- quality threshold

Human editorial approval can be required for high-risk/high-value subjects or uncertain candidates.

## AI role

AI is a **cache miss producer**, not the default delivery path.

Desired steady-state:

`teacher request -> canonical lookup -> adopt -> teach`

Only cache misses use generation/research. This turns each paid generation into a durable VibeSchool content asset and drives marginal generation cost toward zero as curriculum coverage grows.

## Metrics

Track:

- canonical hit rate
- generation miss rate
- duplicate generations prevented
- credits/API cost avoided
- adoption count per asset/version
- customization rate
- teacher quality feedback
- classroom outcome/evidence signals
- assets requiring revision/retirement

## Security

Canonical certified assets: authenticated read through bounded RLS/RPC.
Candidate assets and certification evidence: service/editorial/HQ access only.
Teacher occurrence/adoption rows: teacher-owned/school-authorized RLS.

Do not expose privileged certification mutations directly to browser clients. Any privileged function must have explicit EXECUTE grants, fixed search_path and strict authorization.

## Migration strategy

1. Add canonical_lesson_assets + teacher_lesson_adoptions with RLS and indexes.
2. Add optional `canonical_lesson_asset_id` to lesson_plans for fast provenance lookup.
3. Add deterministic canonical-key helper and lookup/adopt API/RPC.
4. Change lesson generation to lookup-first and generation-on-miss.
5. Remove teacher/school/class identity from canonical generation prompt; apply those as delivery overlays.
6. Backfill only lesson plans that pass canonicalization/quality rules; do not blindly globalize existing teacher plans.
7. Add metrics and Content Engine hooks for revision and retirement.

## Non-goals

- Do not share student data between teachers.
- Do not make one teacher's private notes globally visible.
- Do not overwrite a teacher's customized plan when the canonical version changes.
- Do not treat topic text alone as sufficient identity.
- Do not regenerate merely because a different teacher requested the same certified curriculum lesson.
