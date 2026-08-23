# Cyborg LLM Boundary Rollout

Status: **implementation in progress — not certified**.

Security invariants for certification:

1. No VibeSchool model-provider request exists without a valid, request-bound Cyborg capability.
2. No AI-generated response is accepted as governed output without verified Cyborg lineage and a tamper-evident receipt.
3. No ordinary VibeSchool workload possesses both model-provider credentials and a permitted direct provider call path.
4. Capabilities are caller/model/provider/mission/revision/request/budget bound, short-lived, and single use.
5. Owner-only, publishing, payment, scheduler, and consequential authority gates are not broadened by this boundary.
6. Exact-head CI, migration-contract proof, bypass scanning, and adversarial negative cases must pass before merge/certification.

Provider credentials belong only in the isolated Cyborg LLM gateway execution environment. The gateway writes lineage back to the canonical VibeSchool control plane using `CYBORG_CONTROL_PLANE_SUPABASE_URL` and `CYBORG_CONTROL_PLANE_SERVICE_ROLE_KEY`.
