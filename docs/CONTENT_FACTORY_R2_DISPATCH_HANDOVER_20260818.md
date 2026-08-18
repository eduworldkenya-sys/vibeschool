# Content Factory R2 dispatch handover — 2026-08-18

## Status

The missing R2 Edge dispatch layer is now implemented on branch `ops/content-factory-commissioning-r2-current-main-20260818` and deployed to production Supabase as `content-factory-r2-dispatch` version 1 with JWT verification enabled.

## Contract

The dispatcher is internal-only and additionally requires the Supabase service-role bearer token. It accepts one `taskId`, loads the Worker Engine task and its approved tool contract, and allowlists exactly these routes:

- `content.research.external` → `content-research-worker`
- `content.evidence.semantic_verify` → `content-semantic-verifier`
- `content.authoring.source_grounded` → `content-authoring-worker`

It refuses non-queued tasks, missing worker/tool bindings, unapproved tools, handlers outside the allowlist, and payloads missing the exact domain identifier required by the selected executor.

The dispatcher does not claim or authorize the task itself. The destination executor remains responsible for calling its certified claim RPC, which enforces the Worker Engine objective → plan → plan step → certified capability/skill → active scoped authority → runtime policy chain.

## Safety state

Deployment is non-activating. Global Worker Engine runtime remains OFF, the dedicated `content-factory-r2-canary-01` worker is certified but not active, and the dispatcher cannot make an otherwise unauthorized task executable.

No publication capability exists in the dispatcher allowlist.

## Remaining execution gate

The remaining commissioning work is governance activation, not dispatch infrastructure: expiring worker identity, exact legacy + R1.4 capability grants, bounded budgets, one exact objective/plan/task chain, and a controlled global runtime window. Those should be installed together and tested against one Kenya-curriculum-relevant content target, then reduced/revoked after the canary.

Vercel was not intentionally triggered.
