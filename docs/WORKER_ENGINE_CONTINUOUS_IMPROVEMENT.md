# Worker Engine continuous improvement

This change extends the canonical `hq_workforce_*` control plane. It does not create a second engine and does not enable runtime execution, schedulers, shadow operation, publishing, payments, or authority grants.

## Closed learning chain

1. A version-bound outcome is recorded as an idempotent, append-only incident with expected versus actual behavior, impact, evidence, and a confidence-scored root-cause class.
2. Confirmed failures become immutable, versioned regression cases. Positive controls prevent a repair from improving only the failing sample while degrading known-good work.
3. A repair is proposed against an exact baseline and candidate hash. It must include a protected regression suite.
4. The state machine permits only `candidate → testing → assurance_pending → shadow → canary → promoted`, with rejection from every pre-promotion stage and rollback after promotion.
5. The proposer cannot act as the evaluator for assurance, shadow, canary, or promotion. Every consequential transition is evidence-bound.
6. Versioned health events preserve the metric contract, window, thresholds, evaluator, and source evidence used to classify engine, worker, skill, or lane health.
7. A confirmed earlier-priority gap creates an immutable mission checkpoint, typed dependency edge, blast-radius record, affected-decision inventory, repair lineage, regression and positive-control requirements, fresh revalidation, and explicit resume conditions.

## Dependency Integrity Loop

When later work exposes an earlier or shared defect, the engine classifies it as `blocking_dependency`, `certification_at_risk`, `security_or_data_integrity`, `non_blocking_debt`, or `not_a_defect`. Only the first three require interruption. The active mission is checkpointed before repair; unaffected work may continue.

The engine records every affected worker, certificate, content artifact, commissioning stage, or mission gate. At-risk claims remain at risk until the canonical dependency is repaired and fresh evidence satisfies the recorded revalidation requirements. Resolution requires both a protected regression and a positive control. The checkpoint supplies deterministic resume conditions so the interrupted priority is resumed instead of forgotten.

Recursive dependency repair is evidence-bound and must be cycle-detected by the orchestrator. This schema deliberately records the repair stack without granting workers authority to switch priorities, invalidate certificates, resume runtime, or promote themselves.

### Operational proof hardening

The first controlled production proof uses the existing Grade 10 Chemistry shadow convergence record as a non-consequential checkpoint. Its bootstrap author key was not a registered Worker Engine identity, while the canonical content author had current independent assurance. The finding therefore blocks only that artifact's evaluation eligibility; it does not invalidate unrelated content, workers, tenants, or missions.

`20260821223000_dependency_integrity_operational_proof.sql` closes the two canonical gaps exposed by that case:

- append-only checkpoint events provide deterministic `interrupted -> resume_ready -> resumed -> closed` lineage without mutating evidence snapshots;
- resume requires exact interrupted and repaired revisions, a resolved repair record, fresh passing revalidation for every affected impact, and the unchanged fail-closed runtime posture;
- revalidation rejects implementer/self evidence and contradictory pass claims;
- content convergence rejects unregistered, uncertified, expired, wrong-archetype, or unversioned authors and records evaluator identity separately from the artifact author;
- the legacy evaluation RPC is no longer directly executable by `service_role`; the governed wrapper requires distinct certified evaluator identity and evidence;
- an owner-protected HQ packet explains the checkpoint, finding, blast radius, repair, revalidation, and resume chain.

The proof is control-plane only. It does not publish the Chemistry artifact or activate workers, schedulers, runtime, payments, or authority grants. The pre-repair Chemistry version remains preserved as negative evidence and is not eligible for a fresh score merely because the control plane was repaired.

Evidence tables are append-only. Product roles have no access. The service role can read them and invoke governed functions, but cannot directly forge incidents, regression cases, health events, or candidate transitions.

## Operational example

If a Chemistry teacher guide fails review, preserve the exact guide and worker versions, expected rubric result, actual failed criteria, evaluator version, and source evidence. Register the failure as a regression case, retain a passing guide as a positive control, and propose the smallest relevant skill/context/tool repair. Promotion remains blocked until independent evaluation, shadow, and canary evidence pass. A production regression uses the recorded rollback target and triggers recertification rather than silent self-editing.

## Verification

- `python scripts/validate-worker-engine-continuous-improvement.py`
- `python scripts/validate-supabase-migration-contract.py --changed-from origin/main`
- `python scripts/test-worker-engine-authority-plane-contract.py`
- `supabase/tests/worker_engine_continuous_improvement.sql` in the database contract test environment
- `supabase/tests/worker_engine_dependency_integrity.sql` in the database contract test environment

The migration is architecture-only until reviewed and applied through the governed migration path. Runtime activation remains an explicit later owner gate.
