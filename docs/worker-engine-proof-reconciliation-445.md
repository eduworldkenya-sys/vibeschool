# PR #445 Reconciliation

PR #445 is superseded by the canonical Cyborg architecture merged through PR #448 and must not be merged wholesale.

Useful proof intent from #445 has been rebuilt against current main:

- governed runtime adversarial tests use an active worker fixture so they reach the current lifecycle gate correctly;
- new coverage explicitly proves inactive lifecycle rejection, unconfigured execution-mode rejection, and invalid envelope recipient rejection;
- existing watchdog, authority, fallback, sanitization, trigger, persistence-failure, and clarification proof is preserved;
- proof execution has a dedicated GitHub Actions workflow rather than modifying the older HQ certification workflow.

Once the replacement proof PR is exact-head green and merged, PR #445 may be closed as superseded without losing unique intended coverage.
