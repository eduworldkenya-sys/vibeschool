# Worker Engine commissioning handover — 2026-08-19

## Mission

Complete production commissioning without broadening Worker Engine authority, reconcile all forward production repairs into repository lineage, expose owner-readable readiness evidence, certify exact head, and merge only when repository + production state agree.

## Production evidence already certified

- Gate-2 real chain: research → authoritative-source retrieval → semantic verification → source-grounded authoring → human-review-only draft.
- Three clean production canaries completed.
- Target content remained unchanged; no proposal was applied or published.
- Temporary authority was revoked after each run and runtime returned fail-closed.
- Failure paths exercised: bad source, semantic refutation, worker/model failure, duplicate invocation, expired authority, budget exhaustion, circuit breaker, global stop.
- Multi-worker and cross-capability authority borrowing denied.
- Objective-first scheduler reconciliation passed with zero consequential execution in shadow scheduling.
- Worker Factory reuse/create/certification boundaries passed.
- L2 remains bounded to reversible priority-only internal canary work at R1; finance, payments, publishing, auth/security, credentials and authority/runtime governance remain excluded.

## Production defects discovered during commissioning

1. Retired Groq model default caused semantic worker failure. Supported model is `openai/gpt-oss-120b`.
2. Production Worker Engine R1.4 lineage lacked repository-certified priority-canary semantics; forward-only production repair restored stop/breaker and priority-only execution paths without weakening later approval/verifier controls.
3. Post-merge audit of PR #277 found exact-head clean rebuild and Content Factory Research CI failures caused by repository/production commissioning lineage drift.

## Repository reconciliation in corrective PR #279

The corrective branch is rebuilt on current `main` and restores production commissioning lineage rather than weakening CI:

- `20260818185134_content_factory_gate2_pg_net_commissioning_transport.sql`
- `20260818185319_content_factory_gate2_one_shot_canary_operator.sql`
- `20260818211040_worker_engine_gate2_abort_recovery_contract.sql`
- `20260818211138_worker_engine_gate2_supported_model_pin.sql`
- `20260818211552_worker_engine_r14_priority_canary_forward_repair.sql`
- `20260818212650_worker_engine_bounded_runtime_scheduler.sql`
- `20260818212910_worker_engine_commissioning_readiness.sql`

Repository worker fallbacks for semantic verification and authoring now default to `openai/gpt-oss-120b` rather than the retired model.

The exact-session operator invoker is tracked at `scripts/worker-engine-gate2-canary.sh`. It uses an operator PostgreSQL connection only for the operator-only prepare/bind/finalize/abort lane, invokes deployed workers through service-role transport, consumes the one-shot invocation token per phase, and fail-closes via abort cleanup on error.

HQ owner visibility is available at `/hq/workforce/readiness` and linked from the desktop HQ navigation. The page reads `hq_workforce_get_commissioning_readiness()` only; it cannot activate runtime, grant authority or publish content.

## Safety boundary

The production engine must remain:

- runtime execution OFF
- autonomy L0
- max risk R0
- heartbeat OFF
- Factory OFF
- Shadow execution OFF
- global stop ON
- zero active temporary capability authority
- zero active canary identities/budgets/sessions

The installed one-minute bounded-runtime cron is intentionally inert while runtime execution is OFF.

## Promotion gate

Do not treat the earlier merge as certification. Corrective PR #279 may merge only after:

1. Supabase migration-security contract passes on exact head.
2. isolated clean rebuild passes on exact head.
3. Content Factory Research/Worker Engine gates pass on exact head.
4. TypeScript + production build passes on exact head.
5. production security/performance advisor output is reviewed for new blockers.
6. production runtime and residue are reverified fail-closed/zero.
7. PR head is still the certified SHA and mergeable.

No direct Vercel invocation is part of commissioning. Application deployment should occur only through the normal post-merge path.
