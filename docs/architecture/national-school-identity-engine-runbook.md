# National School Identity Engine — Execution Runbook

## Mission

Maximize trustworthy national school coverage without compromising the existing VibeSchool product.

## Operating model

1. Discover records from authoritative and supporting sources.
2. Preserve source provenance and immutable snapshots.
3. Normalize names and administrative fields without destroying source values.
4. Resolve identities using deterministic identifiers first.
5. Use composite name/location evidence only after deterministic identifiers.
6. Treat ambiguous identities as unresolved; never guess.
7. Promote only through owner-gated server-side operations.
8. Keep canonical identities distinct from directory/discovery records.
9. Audit coverage after every source snapshot.
10. Continuously verify search, onboarding and parent claiming after identity changes.

## Authority order

- Tier 0: Ministry of Education, NEMIS, KNEC and official Ministry school systems.
- Tier 1: government-derived datasets such as World Bank/HDX.
- Tier 2: geospatial/open mapping supporting sources.
- Tier 3: directories and other discovery-only sources.

Tier 3 data may discover a school but must not independently establish canonical identity.

## Matching gates

### Gate A — deterministic

- Exact KNEC code.
- Exact NEMIS/UIC or other official identifier when present in the source snapshot.

### Gate B — composite evidence

- normalized school name;
- county;
- sub-county;
- school level;
- geographic proximity.

Composite evidence creates reviewable evidence. It does not override an authoritative conflict.

### Gate C — review

If multiple canonical schools remain plausible, the engine must leave the candidate unresolved and record the competing evidence.

## Promotion safety

Canonical schools use `pending` until the normal VibeSchool approval/activation process makes them usable. Identity reconciliation is not the same as product activation.

All ingestion and promotion functions are owner-gated. Direct client writes are revoked from public/authenticated roles.

## Coverage metrics

Every source run should report:

- source records;
- matched records;
- unmatched records;
- conflicts;
- duplicates;
- candidates requiring review;
- canonical coverage.

The key metric is **trustworthy coverage**, not raw row count.

## Current production baseline

At the time of this runbook creation:

- 35 active canonical schools;
- 28,833 directory/candidate records;
- 28,833 pending identity candidates;
- 318 pending records with KNEC codes;
- 2 duplicate canonical normalized-name groups;
- 0 candidates promoted by the owner-gated KNEC batch in the current execution context.

The last item is intentional: the production execution context used for engineering verification is not a platform-owner session, and the engine correctly refuses to bypass that boundary.
