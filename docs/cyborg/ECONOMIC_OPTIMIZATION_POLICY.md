# Cyborg Economic Optimization Policy

## Canonical objective

`MINIMIZE_TOKEN_COST_SUBJECT_TO_EQUAL_OR_STRONGER_ASSURANCE`

Token reduction is an optimization objective, never an authorization to weaken certification, adversarial review, security review, evidence freshness, or human approval requirements.

## Representative measurement set

A baseline and every optimized comparison run must contain equivalent mission classes. The canonical representative set begins with:

- Chemistry authoring
- Quality review / certification
- Independent critic / adversarial review
- Repair
- Laban orchestration / routing
- Deterministic governance checks

Every measurement records mission class, task class, evidence SHA, model calls, input/output/total tokens, cost, deterministic hits, cache hits, and final assurance result.

## Optimization order

1. Deterministic execution for explicitly deterministic work.
2. Exact-result cache reuse scoped to immutable evidence/repository SHA.
3. Context reduction and deduplication.
4. Lower-cost models for non-critical work where policy permits.
5. Unchanged-evidence reuse for non-critical work.

Critical tasks (`certification`, `adversarial_review`, `security_review`) may not use deterministic or cache shortcuts. They must remain freshly executed. Context reduction is permitted only when it preserves all required evidence.

## Target ladder

Measure remaining token consumption against the baseline in this order:

`50% -> 25% -> 10% -> 5% -> 1%`

The 1% target is aspirational. The optimization loop must stop before any target that would require weaker assurance.

## Fail-closed rules

A comparison is invalid when:

- baseline and optimized mission classes are not equivalent;
- an evidence SHA is absent;
- a previously passing mission becomes failed or blocked;
- an assurance-critical mission reports zero model execution;
- savings are claimed from non-comparable workloads.

CI proves these invariants in `scripts/cyborg-economic-optimization-proof.ts`.

## HQ reporting

HQ must display persisted evidence, not sample numbers. Until durable telemetry storage is commissioned, in-memory gateway counters are suitable for mission-local enforcement and tests but are not a historical economic dashboard source.
