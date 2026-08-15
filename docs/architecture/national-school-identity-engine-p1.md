# P1 — Authoritative National School Universe

## Objective
Establish the authoritative source hierarchy and a measurable coverage ledger before promoting public-directory records into trusted VibeSchool schools.

## Production integration
P1 extends the existing school identity architecture; it does not create a parallel school directory.

Existing layers:
- `schools` — canonical trusted school identity
- `schools_directory` — discovery records
- `school_identity_candidates` — unresolved identity candidates
- `school_aliases` — trusted alternate identities
- source registry/provenance — evidence about where a record came from

## Authority hierarchy

### Tier 0 — authoritative
- Kenya Ministry of Education
- NEMIS public institution listing
- 2024 Kenya School Census
- KNEC
- Ministry Grade 10/Senior School Selection System

These sources can provide identity evidence for canonicalization. The system must retain the exact source record and retrieval timestamp.

### Tier 1 — government-derived public datasets
- HDX Kenya Schools
- World Bank Kenya Schools datasets

Discovery and corroboration only unless independently re-verified against a Tier 0 source.

### Tier 2 — supporting sources
- ArcGIS school layers
- Open Schools Kenya
- openAFRICA

Useful for coverage, geography and corroboration.

### Tier 3 — discovery-only sources
- commercial directories
- public aggregators
- third-party mirrors
- legacy imports of unknown provenance

Never sufficient by themselves for automatic canonical promotion.

## Coverage ledger

`school_identity_coverage_runs` records the state of each authoritative source snapshot:
- source
- snapshot time
- source record count
- matched canonical count
- unmatched count
- conflict count
- status
- notes

This allows VibeSchool to measure coverage instead of claiming completeness from a single imported dataset.

## National gap equation

`authoritative source universe - canonical VibeSchool identities = coverage gap`

Every gap becomes a reconciliation candidate rather than being silently discarded.

## Source facts

The Ministry's 2024 School Census documentation describes the census as a complete enumeration of basic-education institutions and records official school name, UIC/NEMIS code, Ministry registration number, TSC code, KNEC code, level and administrative geography. The Ministry's NEMIS public surface also exposes an institution-listing report. KNEC documentation confirms that new assessment centres receive KNEC codes through the Sub-County Director of Education process. The current Grade 10 Selection System exposes senior/junior school discovery and KNEC-code fields.

## Security rule

Source data is evidence. It is not permission to write directly into `schools`. Ingestion writes to discovery/provenance/candidate layers through controlled server-side paths. Canonical promotion remains a separate verified decision.

## Exit criteria

P1 is complete when:
1. all Tier 0 sources are registered and classified;
2. an approved extraction/access method exists for each source;
3. source snapshots can be recorded in the coverage ledger;
4. authoritative-vs-canonical gap reports can be generated;
5. no source can bypass the canonical reconciliation pipeline.

## Current status

- Source registry: deployed.
- Tier 0 NEMIS listing and 2024 census: registered.
- Coverage ledger: deployed.
- Bulk authoritative snapshot ingestion: next implementation step; do not fabricate source counts when an official bulk export/API is unavailable.
