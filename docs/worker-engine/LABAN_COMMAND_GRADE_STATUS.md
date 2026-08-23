# Laban Command Grade Status

Status: IMPLEMENTED ON PR BRANCH / NOT YET CERTIFIED

## Implemented command capabilities

| Capability | Status | Enforcement |
|---|---|---|
| Durable mission state | DONE | `hq_workforce_command_missions` |
| Delegation to specialists | DONE | `hq_workforce_command_delegations` |
| Canonical R1.4 authority binding | DONE | delegation requires active, unexpired authority grant |
| Counterfactual planning | DONE | `hq_workforce_command_hypotheses` |
| Confidence + evidence scoring | DONE | bounded `confidence` + `evidence_quality` |
| Mission risk allocation | DONE | risk/operation/record/cost/expiry ceilings |
| Two-key sensitive-action control | DONE | distinct non-worker approvers + expiry state machine |
| Independent command assurance | DONE | commander/executor/verifier separation |
| Independent security observer | DONE | optional fourth distinct role |
| Contradiction challenge | DONE | blocking/critical challenge reopens mission |
| Anti-self-certification | DONE | commander cannot certify own mission |
| Succession/failover | DONE | independent non-worker activation required |
| Immutable command evidence | DONE | hash-chained command ledger |
| Operational war-room snapshot | DONE | mission/delegation/blocker/risk/assurance/failover/learning snapshot RPC |
| Post-mission learning | DONE | terminal mission + root cause + mandatory regression-test reference |
| Architecture drift registry | DONE | permanent critical invariants table |
| Executable architecture drift check | DONE | database assertion proves legacy bridge + canonical authorization |
| CI execution proof | DONE IN WORKFLOW | disposable local Supabase runs Laban command SQL suites at exact PR head |
| Legacy gateway reconciliation | DONE IN REPOSITORY | legacy entrypoint delegates to R1.4 consequential gateway |
| Runtime activation | OFF | migrations assert fail-closed runtime |
| Authority activation | OFF | migrations assert zero active grants |
| Publishing/payments/schedulers | NOT ACTIVATED | outside this workstream |

## Command doctrine

Laban is a high-authority commander, not an unrestricted superuser. Command power includes mission decomposition, counterfactual reasoning, bounded risk allocation, delegation, challenge, replan, escalation, evidence demands, failover, learning and convergence. Consequential mutation remains capability-scoped and must traverse the canonical R1.4 authority/execution/verification chain.

Laban cannot self-grant authority, self-certify, serve as a human two-key approver, activate his own command failover, act as an independent verifier of his own command result, or bypass Global Stop/runtime controls. Scheduler activity creates demand only and never creates authority.

## Certification gate

This branch is not certified until exact-head required checks pass and protected-main merge succeeds. The disposable-local R1.4 acceptance workflow now executes the Laban command suites, including gateway convergence, authority expiry, role separation, two-key gates, independent failover, war-room/learning surfaces, architecture-drift assertions, runtime OFF and zero active authority grants.
