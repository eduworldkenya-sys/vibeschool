# School Identity Engine Test Plan

## Safety tests
- Public/anonymous roles cannot write canonical, candidate, evidence, review, or coverage tables.
- Owner-gated functions reject unauthenticated/non-owner callers.
- Active KNEC identifiers are unique.
- Ambiguous normalized names cannot auto-promote without disambiguating evidence.

## Deterministic matching tests
- Exact KNEC identifier links to the existing canonical identity.
- A new KNEC identifier creates at most one canonical identity.
- Re-running the same source snapshot is idempotent.

## Composite matching tests
- Same normalized name + county/sub-county increases confidence.
- Same name across different counties is not treated as an automatic identity match.
- Composite scoring only creates review evidence; it never directly promotes a school.

## Coverage tests
- Snapshot counts reconcile to source records.
- Matched + review + rejected + unresolved accounts for the candidate universe.
- Repeated snapshots preserve history rather than overwriting prior measurements.

## Frontend contract tests
- Search reads only trusted/approved canonical records.
- Pending/review candidates are not exposed as trusted schools.
- School selection returns a stable canonical school ID.
