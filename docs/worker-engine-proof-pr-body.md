## Summary

Reconstructs the useful governed Worker Engine adversarial proof from superseded PR #445 on top of the canonical Cyborg mainline after #448.

## Changes

- fixes stale lifecycle fixture by using an active worker for downstream control tests;
- adds explicit lifecycle, execution-mode, and envelope-recipient fail-closed cases;
- preserves watchdog, authority, fallback, sanitization, trigger, persistence-failure, and clarification proof;
- adds dedicated proof execution and proof-contract workflows;
- remains strictly non-activating.

## Certification

Do not merge from intent alone. Require exact-head CI success. After this replacement merges, close #445 as superseded.
