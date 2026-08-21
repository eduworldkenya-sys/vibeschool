# Priority 2 — Quality Intelligence & Evaluation System

Lane base: `844fd4f7483d5e098b8959bb0a9828e00469cb48` (`main`, 2026-08-21).

## Mission
Build an independent examination system for Content Worker artifacts. It measures curriculum fidelity, subject accuracy, teachability, pedagogy, classroom readiness, assessment quality, safety, source grounding, Kenyan feasibility, inclusion and teacher usability.

This lane does not build the Critic/Editorial Worker, repair content, publish content, approve releases, or increase Worker Engine authority/autonomy.

## Independence
Priority 1 PR #398 adds worker-owned profiles, preflight and evaluation telemetry. Those signals may be consumed as evidence but are not authoritative Quality Intelligence verdicts. The Content Worker cannot modify this rubric, gold labels or certification threshold, and worker self-review cannot certify its own output.

## Existing production measurement inventory
Read-only production inspection on 2026-08-21 found 6,050 `content_quality_snapshots`, 22 `publication_quality_current` rows, 3 `curriculum_authoring_drafts`, 12 worker-performance rows and 10 worker-certification rows. These are evidence inputs, not assumed gold truth.

## V1 evaluator
The versioned Teacher Guide rubric has eleven weighted dimensions, dimension-specific minimums, an 85/100 overall threshold and hard blockers. A weighted average cannot hide unsafe practical work, material subject error, unsupported curriculum claims, fabricated grounding, unteachable required outcomes, materially wrong assessment answers or unresolved authoritative contradiction.

The evaluator is deterministic and has no worker, publishing or repair capability. Its first job is to prove its own calibration against sealed synthetic gold cases. Calibration reports exact accuracy plus false-positive and false-negative rates. CI fails when any gold classification fails.

## Baselines
1. Evaluator baseline: gold-suite calibration must be green.
2. Historical-system baseline: existing production measurements are captured as uncalibrated evidence until their validity is demonstrated.
3. Worker-artifact baseline: exact pre-Priority-1 outputs must be frozen and evaluated using artifact hash, worker/profile version, evidence hash, rubric hash and evaluator version.

Before/after comparisons are invalid if rubric or evidence identity changes silently. Overall improvement also cannot hide dimension regressions.

## Next slice
After calibration is green, add append-only evaluation-run evidence and import exact Content Worker artifact snapshots for the real pre-Priority-1 baseline. Then compare Priority 1 output against the same frozen examination contract.

## Merge discipline
Remain isolated from PR #398 and unrelated PRs. Reconcile onto exact current `main`; prove intentional diff only; pass dedicated and applicable repository gates; do not mutate production; merge only with an exact-head guard; certify merged `main`, not merely the feature branch.
