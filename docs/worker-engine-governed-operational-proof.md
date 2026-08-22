# Worker Engine Governed Operational Proof

Non-activating proof scope: watchdog fail-closed behavior, authority denial and approval, fallback approval, context sanitization, durable trigger admission, structured clarification, persistence failure, replay/concurrency, Global Stop/commissioning boundary, and bypass analysis. Runtime, schedulers, publishing and payments remain OFF.

## Certification trust contract

Worker Engine proof work MUST NOT be described as ready, complete, merged, or certified from author confidence alone.

Before certification:

1. Fixtures and callers must conform to the current canonical repository contracts; remembered or stale object shapes are not evidence.
2. `npm run typecheck` must pass for the exact candidate head.
3. The governed adversarial test suite must execute, not merely compile.
4. Certification proof code must not use `as any`, `as unknown`, `@ts-ignore`, `@ts-nocheck`, disabled lint, or skipped tests to bypass contracts.
5. A new commit invalidates all CI/certification evidence from the previous head SHA.
6. CI failure is evidence of an unresolved defect until the canonical cause is repaired and a fresh exact-head run passes.
7. "Ready" means preflight evidence exists; "certified" requires independent exact-head CI evidence. If evidence is unavailable, status is UNVERIFIED.
8. Runtime, schedulers, publishing, payments, and consequential authority remain OFF throughout this proof unless separately owner-authorized.

The HQ Control Room Certification workflow mechanically enforces TypeScript conformance, actual adversarial test execution, escape-hatch rejection, and linting for changes under `lib/hq/**`.
