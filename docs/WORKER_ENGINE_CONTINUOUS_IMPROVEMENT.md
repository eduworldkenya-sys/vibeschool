# Worker Engine continuous improvement

This change extends the canonical `hq_workforce_*` control plane. It does not create a second engine and does not enable runtime execution, schedulers, shadow operation, publishing, payments, or authority grants.

## Closed learning chain

1. A version-bound outcome is recorded as an idempotent, append-only incident with expected versus actual behavior, impact, evidence, and a confidence-scored root-cause class.
2. Confirmed failures become immutable, versioned regression cases. Positive controls prevent a repair from improving only the failing sample while degrading known-good work.
3. A repair is proposed against an exact baseline and candidate hash. It must include a protected regression suite.
4. The state machine permits only `candidate → testing → assurance_pending → shadow → canary → promoted`, with rejection from every pre-promotion stage and rollback after promotion.
5. The proposer cannot act as the evaluator for assurance, shadow, canary, or promotion. Every consequential transition is evidence-bound.
6. Versioned health events preserve the metric contract, window, thresholds, evaluator, and source evidence used to classify engine, worker, skill, or lane health.

Evidence tables are append-only. Product roles have no access. The service role can read them and invoke governed functions, but cannot directly forge incidents, regression cases, health events, or candidate transitions.

## Operational example

If a Chemistry teacher guide fails review, preserve the exact guide and worker versions, expected rubric result, actual failed criteria, evaluator version, and source evidence. Register the failure as a regression case, retain a passing guide as a positive control, and propose the smallest relevant skill/context/tool repair. Promotion remains blocked until independent evaluation, shadow, and canary evidence pass. A production regression uses the recorded rollback target and triggers recertification rather than silent self-editing.

## Verification

- `python scripts/validate-worker-engine-continuous-improvement.py`
- `python scripts/validate-supabase-migration-contract.py --changed-from origin/main`
- `python scripts/test-worker-engine-authority-plane-contract.py`
- `supabase/tests/worker_engine_continuous_improvement.sql` in the database contract test environment

The migration is architecture-only until reviewed and applied through the governed migration path. Runtime activation remains an explicit later owner gate.
