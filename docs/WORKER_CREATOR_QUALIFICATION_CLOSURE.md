# Worker Creator Qualification Closure

This closes the proof layer above PR #412 without weakening Worker Engine authority.

## Invariants
- Creation produces a professional candidate, never production authority.
- Creator evidence cannot certify its own candidate.
- Certification requires fresh independent evidence after the latest repair.
- R1 requires shadow evidence; R2 requires shadow plus controlled canary evidence; R3 additionally requires explicit human-authority evidence.
- Global Stop and authority grants remain separate runtime gates.
- Certification expires and standard/worker drift requires recertification.

## Qualification loop
`BASELINE_READY -> INDEPENDENT_EVALUATION -> NEEDS_REPAIR -> REVERIFYING -> SHADOW_REQUIRED -> CANARY_REQUIRED -> AWAITING_HUMAN_AUTHORITY -> CERTIFIED`, with `FAILED_QUALIFICATION`, `SUSPENDED`, and `REVOKED` terminal/exception states.

The production qualification harness evaluates real author, critic/quality, operations, support and finance/security workers. A failed worker remains uncertified; failure is evidence and must never be converted into a synthetic pass.
