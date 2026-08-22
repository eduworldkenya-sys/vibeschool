# Worker Engine Governed Operational Proof

This proof is rebased conceptually onto the current canonical Cyborg/Worker Engine implementation. It preserves useful adversarial coverage from superseded PR #445 without importing its stale branch lineage.

## Required proof

The governed runtime proof must exercise lifecycle fail-closed behavior, execution-mode admission, envelope validation, watchdog fail-closed behavior, authority denial and approval, fallback approval, context sanitization, durable trigger admission, persistence failure, and structured clarification.

## Certification contract

1. Proof fixtures must conform to current canonical repository contracts.
2. The proof must execute; compilation alone is insufficient.
3. TypeScript and lint must pass at the exact candidate head.
4. Proof code must not use `as any`, `as unknown`, `@ts-ignore`, `@ts-nocheck`, disabled lint, or skipped tests to bypass contracts.
5. A new commit invalidates prior exact-head certification evidence.
6. CI failure remains unresolved evidence until the canonical cause is repaired and a fresh exact-head run passes.
7. Runtime, schedulers, automatic publishing, payments, and consequential authority remain OFF unless separately owner-authorized.
