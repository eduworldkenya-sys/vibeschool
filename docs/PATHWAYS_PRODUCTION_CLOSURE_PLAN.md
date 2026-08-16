# Pathways Production Closure Plan

**Status:** Active closure program  
**Rule:** Do not add more Pathways architecture unless testing exposes a genuine architectural defect.  
**Definition of done:** Pathways is closed only when the production user journey, authoritative data, evidence, authorization boundaries, integrity, UX and operational state are proven—not merely because code is merged.

## Current engineering assessment

Pathways already has the core truth model and catalogue. The dominant remaining production gap is authoritative school-offering population and reconciliation through the existing School Identity Engine.

Baseline observed during the August 16, 2026 investigation:

| Area | Observed production state | Assessment |
| --- | ---: | --- |
| Pathways | 3 / 3 verified | Core catalogue exists |
| Tracks | 7 / 7 verified | Core catalogue exists |
| Subject combinations | 14 / 14 verified | Core catalogue exists |
| Combination subject claims | 42 / 42 resolved | Subject mapping exists |
| Careers | 14 / 14 verified | Career catalogue exists |
| Career links | 14 / 14 verified | Relationships exist |
| School offerings | 1 | Major production gap |
| Pathway sources | 5 | Source framework exists |
| Pathway observations | 11 | Barely exercised |
| School Identity candidates | 28,833 | Large discovery universe |
| Authoritative school observations | 1 | Bulk authoritative ingestion unproven |
| Authoritative reconciliations | 1 | Reconciliation unproven at scale |
| Recorded School Identity Engine runs | 0 | Operational execution/audit loop unproven |

These counts are a historical baseline, not permanent truth. Every new work session must re-query GitHub and production Supabase before relying on them.

## P0 engineering question

Can VibeSchool safely turn Ministry evidence into canonical, replay-safe, evidence-backed school offerings at production scale without guessing school identity?

Until that is proven, Pathways is not production-certified.

## Closure stages

### Stage 0 — Freeze and baseline

Pin the Git SHA, production migration state, current counts, relevant schemas and security surfaces. Do not redesign architecture unless a failed invariant demonstrates that the existing model cannot support the requirement.

**Exit:** A reproducible GitHub/Supabase baseline exists.

### Stage 1A — Ministry source contract

Define source identity, row identity, source version, publication/effective dates, school identifiers, pathway/track/combination fields and provenance requirements.

**Exit:** Every incoming row can be uniquely traced to its source.

### Stage 1B — Observation ingestion

Import Ministry data as observations/staging facts, never directly as canonical school offerings. Enforce deterministic idempotency and explicit rejection/quarantine reasons.

**Exit:** Every source row is accepted, rejected or quarantined. Nothing silently disappears.

### Stage 1C — School Identity reconciliation

Resolve observations through the existing School Identity Engine. Preferred hierarchy:

1. Exact authoritative school code + unique canonical school.
2. Proven historical code/name alias.
3. Exact normalized name plus sufficiently strong location identity, only when unique.
4. Ambiguous/fuzzy match -> review queue.
5. Genuinely missing canonical school -> missing-school candidate/recovery flow.
6. Conflicting identifiers -> quarantine.

A fuzzy similarity score must never create a canonical school or offering by itself.

**Exit:** Every school observation is resolved, conflicted or quarantined.

### Stage 1D — Canonical offering projection

Only resolved authoritative observations may create or update canonical `pathway_school_offerings`. Preserve evidence, source history and effective-state semantics.

**Exit:** Every published school offering has a canonical school and traceable evidence chain.

### Stage 1E — Bulk certification run

Run a representative real Ministry batch through the complete pipeline and then replay it deliberately. Scale only after the pilot is deterministic.

**Exit:** Replaying identical source data produces zero unwanted canonical changes or duplicates.

### Stage 2 — Evidence certification

Prove provenance for every published pathway, track, combination, subject claim, career relationship and school offering. Do not treat a verification-state field alone as proof.

**Exit:** No published authoritative claim lacks acceptable evidence.

### Stage 3 — Integrity and adversarial testing

Test duplicates, renamed schools, missing/changing codes, conflicting sources, stale observations, reordered imports, interrupted imports, partial replay and source corrections.

Required cases include:

- Same Ministry file twice -> zero duplicate canonical facts.
- Same rows in different order -> identical result.
- Interrupted import + resume -> same result as uninterrupted import.
- Duplicate source rows -> one canonical claim.
- Renamed school with unchanged code -> one identity with preserved history.
- Same school name in different locations -> never merge on name alone.
- Missing authoritative code -> evidence-based resolution or quarantine.
- Conflicting code/name/location -> conflict, not silent correction.
- Newer source followed by older source -> older source cannot regress current truth.
- Source correction -> controlled supersession with history preserved.
- School missing from VibeSchool -> recovery/candidate path, not nearest-name attachment.

**Exit:** Canonical state remains deterministic and replay-safe under every required test.

### Stage 4 — Production authorization certification

Test real production-compatible identities, not only policy definitions or service-role access.

Principals should include anonymous, learner owner, different learner, linked parent, unlinked parent, authorized teacher, unrelated teacher, admin/operator and service role.

Surfaces should include public catalogue, recommendations, school discovery, Quick Check state, drafts, Passport, parent support, teacher support, source observations, reconciliation/review tables and privileged RPCs.

For each relevant principal/surface pair certify SELECT, INSERT, UPDATE, DELETE and RPC as ALLOW, DENY or N/A.

**Exit:** Complete RLS/authorization matrix passes.

### Stage 5 — Production E2E

Certify at minimum:

1. Anonymous learner explores Pathways and completes Quick Check.
2. Learner receives a recommendation, opens subjects and discovers schools.
3. Authentication interrupts and safely resumes the journey.
4. Authenticated learner creates/updates Passport state.
5. Correct linked parent reaches only permitted support state.
6. Correct teacher reaches only authorized support state.
7. Unrelated learner/parent/teacher attempts the same URLs/RPCs and is rejected.
8. School-not-found/recovery path behaves safely.

**Exit:** All P0 production journeys pass.

### Stage 6 — UX/mobile proof

Verify autocomplete, keyboard interaction, no-result recovery, empty states, evidence explanations, loading, retry, errors, session expiry and mobile responsiveness.

**Exit:** No critical UX dead end or misleading state remains.

### Stage 7 — Operational certification

Check Supabase security/advisors, runtime logs, RPC failures, exact production counts, GitHub-to-production migration parity, rollback/runbook readiness and schema/type parity.

**Exit:** No unwaived P0/P1 release blocker.

### Stage 8 — Evidence pack and sign-off

Record exact Git SHA, production migration head, source versions, counts, reconciliation outcomes, conflicts, quarantines, security test evidence, E2E evidence, operational checks and residual risks.

**Exit:** `Pathways Production Ready` may be declared only when all preceding gates pass.

## Required data pipeline

The intended authoritative flow is:

`Ministry source -> immutable source observation -> normalization/validation -> School Identity resolution -> resolved/conflict/quarantine -> Pathway/track/combination validation -> canonical school offering projection -> evidence/provenance`

There must be no shortcut equivalent to:

`Ministry CSV -> direct INSERT into pathway_school_offerings`

That would bypass canonical identity and evidence controls.

## Non-negotiable invariants

- No Ministry row silently disappears.
- No uncertain school match becomes canonical truth.
- No direct source-to-canonical-offering bypass.
- No identical replay produces duplicate schools or offerings.
- No older source snapshot silently overwrites newer evidence.
- No authoritative published claim exists without provenance.
- No source update destroys historical evidence.
- No service-role test counts as proof of learner/parent/teacher RLS.
- Quarantine is a valid successful outcome; guessing is a failure.
- A merged PR is not production certification.

## Priority order

### P0 — Authoritative school-offering population and reconciliation

This is the dominant gap. Prove the School Identity Engine and authoritative observation pipeline using a representative Ministry batch before scaling.

### P0 — Production authority proof

Passport, learner, parent and teacher boundaries require authenticated allow/deny execution evidence.

### P1 — Replay, stale-source and conflict semantics

Bulk population must not begin until repeated and out-of-order imports are harmless.

### P1 — Evidence completeness

Independently prove evidence relationships for all published authoritative claims.

### P1 — Operational parity

Certify GitHub migrations, production Supabase state, advisors, logs and deployed behavior together.

### P2 — Cosmetic refinement

Do not interrupt closure for aesthetic work unless testing identifies a real usability, trust or accessibility defect.

## GitHub work packages

Execute as one closure program with dependent packages:

- `PATH-CLOSE-00` — Baseline + architecture freeze
- `PATH-DATA-01` — Ministry source contract
- `PATH-DATA-02` — Observation ingestion + idempotency
- `PATH-ID-03` — Bulk school identity reconciliation
- `PATH-ID-04` — Conflict/quarantine + missing-school recovery
- `PATH-DATA-05` — Canonical offering projection
- `PATH-EVID-06` — Evidence certification
- `PATH-INT-07` — Replay/integrity certification
- `PATH-SEC-08` — Production authority matrix
- `PATH-E2E-09` — Production journeys
- `PATH-UX-10` — Mobile/error-state proof
- `PATH-OPS-11` — Migration/advisor/runtime certification
- `PATH-REL-12` — Production evidence pack and sign-off

Security harness and evidence-query work may proceed in parallel where safe, but final certification must respect dependencies.

## Immediate next work

Begin with **PATH-DATA-01/05 — Authoritative School Offering Population & Certification**.

Take a real representative Ministry subset through:

`source -> observation -> School Identity Engine -> reconciliation evidence -> canonical school -> Pathways offering -> provenance -> replay`

Then import the exact same dataset again.

Stage 1 fails if:

- the second execution changes canonical truth without a source change;
- ambiguous schools are guessed instead of quarantined;
- duplicate schools or offerings appear; or
- any source row cannot be accounted for.

Only after this pipeline passes should the full accessible Ministry dataset be scaled through it.

## Handoff instruction for future engineering sessions

Before changing anything:

1. Inspect current GitHub `main` and open Pathways work.
2. Inspect live Supabase schema, migration state and production counts.
3. Compare those facts with this document; treat recorded counts as historical baseline only.
4. Continue from the first closure package whose exit gate is not proven.
5. Do not add new Pathways architecture unless testing exposes a genuine architectural defect.
6. Never declare Pathways complete merely because a PR merged.

The governing closure criterion is:

> Pathways is complete only when authoritative school offerings, evidence, integrity, production authorization, E2E journeys, UX/mobile behavior and operational state are all proven in production.
