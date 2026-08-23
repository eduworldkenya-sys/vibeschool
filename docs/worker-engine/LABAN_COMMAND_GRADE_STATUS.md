# Laban Command Grade Status

Status: IMPLEMENTED ON PR BRANCH / NOT YET CERTIFIED

## Implemented command capabilities

| Capability | Status | Enforcement |
|---|---|---|
| Durable mission state | DONE | `hq_workforce_command_missions` |
| Delegation to specialists | DONE | `hq_workforce_command_delegations` |
| Canonical R1.4 authority binding | DONE | delegation requires active, unexpired authority grant |
| Counterfactual planning | DONE | `hq_workforce_command_hypotheses` |
| Confidence scoring | DONE | bounded `confidence` + `evidence_quality` |
| Mission risk allocation | DONE | `hq_workforce_command_risk_allocations` |
| Two-key sensitive-action control | DONE | distinct requester/approver constraints + approval state machine |
| Independent command assurance | DONE | commander/executor/verifier separation |
| Independent security observer | DONE | optional fourth distinct role |
| Contradiction challenge | DONE | blocking/critical challenge reopens mission |
| Anti-self-certification | DONE | commander cannot certify own mission |
| Succession/failover | DONE | independent third-party activation required |
| Immutable command evidence | DONE | hash-chained command ledger |
| Post-mission learning contract | DONE | root-cause + invariant + regression-test references |
| Architecture drift registry | DONE | permanent critical invariants table |
| Legacy gateway reconciliation | DONE IN REPOSITORY | legacy entrypoint delegates to R1.4 consequential gateway |
| Runtime activation | OFF | migrations assert fail-closed runtime |
| Authority activation | OFF | migrations assert zero active grants |
| Publishing/payments/schedulers | NOT ACTIVATED | outside this workstream |

## Non-negotiable command doctrine

Laban is a high-authority commander, not an unrestricted superuser. Command power includes mission decomposition, delegation, challenge, replan, escalation, evidence demands, failover and convergence. Consequential mutation remains capability-scoped and must traverse the canonical R1.4 authority/execution/verification chain.

Laban cannot self-grant authority, self-certify, act as an independent verifier of his own command result, or bypass Global Stop/runtime controls. Scheduler activity creates demand only and never creates authority.

## Certification gate

This branch is not certified until exact-head required checks pass and protected-main merge succeeds. Structural SQL tests assert gateway convergence, authority expiry enforcement, role separation, two-key completion gates, independent failover activation, runtime OFF and zero active authority grants.
