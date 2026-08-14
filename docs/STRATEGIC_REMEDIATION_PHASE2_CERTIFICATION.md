# Strategic Remediation Phase 2 — Certification Boundary

## Scope

Phase 2 closes the repository-level ambiguity around the external consultant's remaining strategic findings without pretending that code can complete regulatory approvals, commercial validation or partnerships.

## Certified repository changes

1. Publication-level curriculum provenance is now explicit and evidence-backed.
2. `KICD approved` cannot be represented by the provenance contract unless an external approval reference exists.
3. Publication authors can draft/map provenance but cannot self-certify reviewed, verified or externally approved states.
4. Provenance is protected by RLS and explicit grants.
5. A read-only SQL verification script documents the expected database contract.
6. The 14-gap remediation register records what is implemented, what was already present, what requires measurement and what remains an external dependency.
7. The main CI gate enforces the remediation truth contract before TypeScript, ESLint and production build.

## Explicitly not certified by this PR

- ODPC registration or legal opinion.
- KICD approval/endorsement of any publication.
- M-Pesa merchant readiness or Daraja production credentials.
- A pricing model, CAC/LTV ratio or conversion uplift that has not been measured.
- Telco, publisher, government or other strategic partnerships that do not yet exist.
- Worker Engine autonomy beyond its separately governed mission.

## Merge gate

This branch is merge-ready only when its exact PR head passes all repository-required checks. The database migration is repository-ready; production application remains subject to the project's existing controlled Supabase migration/promotion process.
