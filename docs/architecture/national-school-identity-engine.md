# VibeSchool National School Identity Engine

**Status:** Approved architecture / implementation roadmap  
**Quality bar:** Staff/Principal engineering  
**Scope:** Kenya national school identity, reconciliation, verification, and frontend discovery

## 1. Vision

Every legitimate school in Kenya can be reliably found, correctly identified, and trusted inside VibeSchool, regardless of which public source contains it.

VibeSchool is not building another static school directory. It is building a trusted, continuously improving national school identity layer that supports onboarding, parent claiming, school discovery, and future education services.

## 2. Mission

**Discover → Reconcile → Verify → Serve.**

VibeSchool must discover schools from authoritative and supporting sources, determine whether records represent the same real-world institution, verify identities using the strongest available evidence, and expose only appropriately trusted schools to users.

## 3. Current VibeSchool foundation

The engine extends existing production architecture rather than creating a parallel school system.

Existing building blocks include:

- `schools` — canonical application identities.
- `schools_directory` — broad discovery/source records.
- `school_identity_candidates` — records awaiting reconciliation.
- `school_aliases` — alternate/verified names.
- source and ingestion provenance structures.
- protected school search/reconciliation functions.
- location-aware search and verification/confidence metadata.

The National School Identity Engine is the orchestration and decision layer that makes these components operate as one national system.

## 4. Target architecture

```text
National public sources
        ↓
Source authority + provenance registry
        ↓
Ingestion
        ↓
Normalization
        ↓
Identity candidates
        ↓
Deterministic matching
        ↓
Composite/entity resolution
        ↓
Evidence + confidence
        ↓
┌──────────────┬──────────────┬──────────────┐
│ Matched      │ New          │ Conflict     │
│ identity     │ school       │ / uncertain  │
└──────┬───────┴──────┬───────┴──────┬───────┘
       ↓              ↓              ↓
   reconcile       verify         human review
       └──────────────┬──────────────┘
                      ↓
              Canonical school
                      ↓
              Secure school search
                      ↓
                  Frontend
```

## 5. Source authority model

### Tier 0 — Government authority

- Ministry of Education and official Ministry systems.
- KNEC institutional identifiers and relevant official systems.
- NEMIS-related authoritative data where legitimately available.

### Tier 1 — Government-derived/public institutional data

- HDX Kenya schools.
- World Bank/energy/geospatial distributions of Ministry data.
- official or government-derived ArcGIS layers.

### Tier 2 — Supporting/open sources

- Open Schools Kenya.
- openAFRICA.
- county/institutional datasets.
- other credible public datasets.

### Tier 3 — Discovery-only sources

- commercial directories.
- crowdsourced directories.
- search-derived records.

A lower-tier source may discover a school but does not automatically establish canonical authority.

## 6. Identity rules

### Primary identifiers

Use exact official identifiers first where present:

1. KNEC code.
2. NEMIS/UIC or equivalent official identifier.
3. Ministry registration identifier.
4. Other stable institutional source IDs with proven authority.

### Secondary identity evidence

When identifiers are absent or conflicting, use combinations of:

- normalized school name.
- aliases.
- county.
- sub-county.
- ward/location.
- school level/type.
- coordinates and geographic proximity.
- source corroboration.
- historical identity evidence.

**Discovery is not verification.** Original source values must be retained even after normalization.

## 7. Decision model

| Evidence | Decision |
|---|---|
| Exact authoritative identifier match | Deterministic reconciliation |
| Strong composite match | High-confidence reconciliation |
| Multiple independent sources corroborate | Increase confidence; verify authority |
| Strong new-school evidence | Candidate for controlled canonical promotion |
| Medium confidence | Human review |
| Conflicting authoritative evidence | Block automatic promotion and review |
| Low confidence | Remain pending candidate |

The engine must never silently merge conflicting identities.

## 8. Canonical identity contract

One real-world school should have **one VibeSchool canonical school identity**.

The canonical identity may retain:

- official identifiers.
- source identifiers.
- aliases.
- historical names.
- school level/type.
- location history.
- provenance.
- verification state.
- evidence and reconciliation history.

Many source records can therefore map to one canonical identity without losing source history.

## 9. Missing-school detection

National coverage is measured, not assumed.

The engine periodically compares the strongest available source universe against VibeSchool's canonical universe:

```text
Authoritative/source universe
        MINUS
VibeSchool canonical identities
        =
Coverage gaps
```

Each gap becomes a candidate and is processed through the same reconciliation and verification pipeline.

This is the mechanism that addresses cases such as a legitimate public school appearing in a government/public source but not in the current VibeSchool directory.

## 10. Frontend contract

The frontend must consume the trusted search/read layer, not raw candidates.

Parents should experience a single flow:

> **Find your school**

The UI must not expose internal source tiers, raw candidates, confidence calculations, or reconciliation state.

If no trusted result exists, the product should provide a **Can't find your school?** path that creates a discovery candidate with user-supplied evidence for reconciliation.

## 11. Production safety rules

1. Do not mass-promote raw directory records.
2. Do not weaken RLS or authorization to accelerate reconciliation.
3. Do not use fuzzy matching as the first identity mechanism.
4. Do not overwrite source evidence with normalized values.
5. Do not silently merge conflicting authoritative records.
6. Do not expose pending/rejected candidates as trusted schools.
7. Every automated decision must be explainable from retained evidence.
8. Every migration must be reversible and production-verified.
9. Existing onboarding, parent claiming, and school search must remain protected during expansion.
10. Do not claim national completeness without measurable coverage evidence.

## 12. Implementation roadmap

### P0 — Protect the existing product

- Preserve onboarding and parent claiming.
- Preserve canonical school identities.
- Preserve security boundaries.
- Establish rollback and verification gates.

### P1 — Establish the national source universe

- Register authoritative and supporting sources.
- Capture provenance and licensing metadata.
- Ingest source records without promoting them blindly.
- Measure source coverage.

### P2 — Upgrade the existing foundation into the Identity Engine

- Deterministic identifier matching.
- Normalized identity matching.
- Administrative/geographic matching.
- Alias resolution.
- Evidence storage.
- Confidence scoring.
- Conflict detection and review workflow.

### P3 — Close national coverage gaps

- Compare authoritative/source universes against VibeSchool.
- Classify matched, probable, missing, duplicate, conflicting, and stale records.
- Create candidates for missing institutions.

### P4 — Trusted canonical population

- Promote only records satisfying promotion rules.
- Reconcile duplicates into one canonical identity.
- Preserve provenance and evidence.

### P5 — Frontend integration

- Serve trusted schools through secure search.
- Improve parent school selection UX.
- Add missing-school request flow.

### P6 — Continuous synchronization

- Scheduled source refreshes.
- New-school detection.
- Rename/identifier/location changes.
- Closure/merger detection.
- Re-verification of stale identities.

### P7 — Advanced intelligence

Only after deterministic foundations are reliable:

- fuzzy/entity matching.
- geographic similarity.
- source-quality scoring.
- anomaly detection.
- automated conflict prioritization.
- national coverage dashboards.

## 13. Success measures

The north-star metric is:

> **Maximum trustworthy national school coverage.**

Track at minimum:

- canonical schools by level/county.
- source coverage.
- matched records.
- verified new schools.
- unresolved candidates.
- conflicts.
- duplicate rate.
- stale-record rate.
- missing-school rate.
- frontend search success rate.
- parent school-selection failure rate.

Do not optimize for raw record count. Optimize for **trusted coverage**.

## 14. Current production baseline

At the time this document was created, production contained:

- 28,833 `schools_directory` records.
- 28,833 pending identity candidates.
- 35 canonical schools.
- 318 directory records with KNEC codes.
- 0 exact KNEC matches against the current canonical set.
- 27 exact normalized-name matches to canonical schools (not necessarily unique canonical identities).

The directory is primarily primary-school data, with a smaller secondary-school population and a small number of other education types. This confirms that the current directory must not be treated as a complete national master list.

## 15. Engineering standard

This program is governed by the VibeSchool Staff/Principal engineering standard:

**Inspect → establish contracts → model threats → implement the smallest correct architectural change → test → verify with production evidence → monitor → iterate.**

Do not patch symptoms when the underlying identity contract is wrong. Do not declare completion based on code appearance alone.

## 16. Non-goals

The engine is not intended to:

- become a generic public data warehouse.
- expose raw government datasets directly to parents.
- blindly import every directory record.
- replace government education systems.
- treat a commercial directory as authoritative.
- use AI as a substitute for authoritative identifiers and evidence.

Its purpose is to make VibeSchool's school identity **trusted, comprehensive, explainable, and maintainable**.