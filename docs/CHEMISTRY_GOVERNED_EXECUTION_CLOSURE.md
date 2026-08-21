# Chemistry governed execution closure

## Current-truth finding

PR #434 created the Chemistry mission registry and queued chapter items, but it did not include an executable stage/handoff contract. A queued item therefore could not safely progress through Author, Quality, Critic, Repair, fresh Quality and fresh Critic. This repair closes that canonical control-plane gap without activating runtime or publishing content.

## Implemented contract

- Exact stage-to-worker binding with current independent certification checks.
- Service-only claim and completion RPCs.
- Exact source version/hash binding and stale-result rejection.
- Idempotent replay for an unexpired lease.
- Bounded leases, timeout recovery and three-attempt escalation.
- Append-only stage event evidence; product roles cannot write attempts or events.
- P2 blockers cannot be erased by a P3 pass.
- Repair creates a new iteration and forces fresh P2 then fresh P3.
- Shadow outputs declaring side effects or publication fail closed.
- Runtime, normal shadow scheduler and schedulers remain OFF; Global Stop remains ON.
- The final successful state is `WAITING_HUMAN_REVIEW`, never published.

## State separation

This repository change makes the stage executor implementable and locally verifiable. It does not claim that Edge Functions are deployed, that real Chemistry chapters have completed model runs, that production workers have fresh certificates, or that content is release eligible. Those require authoritative production evidence and independent evaluator identities on the exact deployed revision.

## Rollback

The migration is additive and non-activating. Stop issuing claims, leave Global Stop active, and ignore/remove the new service-only RPC grants in a forward migration. Existing mission, convergence and publication records remain unchanged.
