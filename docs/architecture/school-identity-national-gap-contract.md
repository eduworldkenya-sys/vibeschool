# National School Identity Gap Contract

## Purpose
Define the smallest reproducible contract for measuring how much of the public school universe VibeSchool has represented without promoting uncertain identities.

## Authority order
1. Ministry/NEMIS authoritative institutional records
2. KNEC identifiers and official education-system records
3. Ministry selection/placement school records
4. World Bank/EnergyData and other government-derived datasets
5. County/open-data sources
6. Commercial directories and community sources

Lower tiers corroborate and discover; they do not override a higher-authority identity.

## Identity states
- `discovered`: source record exists but has no trusted VibeSchool identity.
- `candidate`: normalized source record awaiting resolution.
- `matched`: linked to a canonical school with sufficient evidence.
- `review`: plausible match exists but automated promotion is unsafe.
- `rejected`: reviewed and determined not to represent a canonical identity.

## Coverage metrics
For every source snapshot calculate:
- source records
- unique source identifiers
- matched canonical identities
- unmatched candidates
- review queue
- rejected records
- duplicate source identities
- canonical identities with authoritative identifiers
- unresolved authoritative identifiers

## Promotion gates
1. Exact authoritative identifier match: automatic reconciliation.
2. New authoritative identifier: canonical creation is allowed only through the owner-gated promotion path.
3. Name-only match: never auto-promote when the normalized name is ambiguous.
4. Composite score: creates review evidence, never direct canonical mutation.
5. Every decision records source/evidence and remains auditable.

## Operational rule
Coverage is not the number of rows imported. Coverage is the percentage of an authoritative source universe for which VibeSchool has a defensible identity decision.

## Definition of done
The national gap is closed only when every authoritative source record is either matched, explicitly rejected, or in an auditable review queue, with source snapshot provenance and no unexplained duplicate canonical identifiers.
