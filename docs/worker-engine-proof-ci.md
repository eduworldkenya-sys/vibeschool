# CI

Two dedicated workflows protect the reconciliation:

- `Worker Engine Governed Proof` executes typecheck, the compiled adversarial suite, escape-hatch detection, and lint.
- `Worker Engine Proof Contract` verifies required adversarial cases and the non-activation/supersession contract.
