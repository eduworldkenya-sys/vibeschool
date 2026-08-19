## Mission

<!-- State the bounded engineering mission. -->

## Engineering Control Plane Manifest

- Base SHA: `REQUIRED`
- Candidate head SHA: `AUTO_VERIFIED_BY_CI`
- Upstream dependencies: `none | PR/Task identifiers`
- Shared contracts touched: `none | AUTH | DATABASE | AUTHORIZATION | IDENTITY | HQ | WORKER | TELEMETRY | PAYMENTS | CI`
- Database migration impact: `none | additive | mutating | destructive`
- RLS / grant impact: `none | yes`
- Auth impact: `none | yes`
- Identity impact: `none | yes`
- School identity impact: `none | yes`
- Generated DB type impact: `none | yes`
- Storage impact: `none | yes`
- Edge Function impact: `none | yes`
- HQ / shared navigation impact: `none | yes`
- Worker Engine impact: `none | yes`
- Telemetry impact: `none | yes`
- Production mutation status: `NONE | READ_ONLY_INSPECTION | SEPARATELY_AUTHORIZED`
- Required certification classes: `TIER_A | TIER_B | TIER_C | TIER_D` (list all required)

## Security / Data Integrity Findings

- Unresolved RED findings: `0`
- Known production-safety contradiction: `none`

## Certification Evidence

Do not claim `MERGE READY` from historical green checks. Record exact candidate SHA, exact-current main SHA, run IDs, migration/type hashes where relevant, reconstruction/security/build results, read-only production drift snapshot, and unresolved findings.
