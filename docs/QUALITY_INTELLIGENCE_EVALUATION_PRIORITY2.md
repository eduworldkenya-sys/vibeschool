# Priority 2 — Quality Intelligence & Evaluation System

Base at lane creation: `05468bdb98f065679dd5706f53fa11271ddff0d0` (`main`, 2026-08-21).

## Mission

Build an independent measurement and examination system that can determine whether Content Worker outputs are correct, classroom-ready, safe, curriculum-faithful and improving over time.

This lane does **not** build the Critic/Editorial Worker. It does **not** replace or extend the Content Worker. It does **not** publish, approve, repair, or increase Worker Engine autonomy.

## Independence boundary

Priority 1 PR #398 adds worker-owned professional context, preflight and an evaluation ledger. Those signals are useful telemetry, but they are not authoritative Priority 2 judgments. In particular:

- Content Worker self-review cannot certify Content Worker output.
- Content Worker runtime cannot modify the independent rubric or sealed gold labels.
- A worker preflight result is evidence presented to the evaluator, not the evaluator's verdict.
- Certification thresholds belong to Quality Intelligence governance, not the worker profile.
- Future model-assisted judging must record judge identity/version/prompt/evidence and remain separate from publication authority. That capability is intentionally not introduced here.

## Existing production evidence found before implementation

Read-only production inspection on 2026-08-21 found:

- `content_quality_snapshots`: 6,050 rows.
- `publication_quality_current`: 22 rows.
- `curriculum_authoring_drafts`: 3 rows.
- `hq_workforce_worker_performance`: 12 rows.
- `hq_workforce_worker_certifications`: 10 rows.

These datasets demonstrate that VibeSchool already measures several structural/runtime properties. They do not, by themselves, constitute a calibrated independent editorial examination system. Existing scores must therefore be treated as evidence inputs until their measurement contracts are calibrated.

## V1 examination model

The first independent Teacher Guide rubric measures eleven dimensions:

1. curriculum fidelity;
2. subject accuracy;
3. outcome teachability;
4. pedagogy and sequence;
5. classroom readiness;
6. assessment quality;
7. safety and practical integrity;
8. source grounding;
9. Kenyan context and feasibility;
10. inclusion and differentiation;
11. teacher usability.

The overall threshold is 85/100, but weighted averages cannot hide critical defects. Each dimension has a minimum certified score and hard blockers override the average.

## Evaluator quality controls

The evaluator must itself be tested. `teacher-guide-gold-v1.json` contains sealed synthetic cases covering:

- strong classroom-ready material;
- structural completeness without teachable outcome coverage;
- plausible subject error;
- unsafe practical work;
- fabricated grounding;
- a high average hiding a critical dimension failure;
- major classroom-readiness deficiency;
- threshold certification.

Calibration reports false-positive and false-negative rates as well as exact case accuracy. A calibration failure fails CI.

## Baseline protocol

Priority 2 distinguishes three baselines:

- **Evaluator baseline:** the evaluator must classify the sealed gold set correctly before it may assess workers.
- **Historical-system baseline:** existing production quality/runtime metrics are captured read-only and explicitly labelled uncalibrated where their measurement validity has not been demonstrated.
- **Worker artifact baseline:** exact Content Worker artifacts are evaluated against a frozen rubric/evidence bundle before Priority 1 improvements are compared. This must bind worker identity, worker/profile version, artifact hash, rubric hash, evidence hash, evaluator version and timestamp.

No before/after claim is valid if the rubric/evidence identity differs silently between runs.

## Regression rule

A later artifact is not considered an improvement merely because its overall score rises. Dimension deltas are calculated independently. Any negative dimension delta is surfaced as a regression and must be reviewed; blocker introduction always fails the comparison.

## Next implementation slice

After evaluator calibration is green, add an append-only evaluation-run evidence contract and import exact Content Worker artifact snapshots without granting the evaluator publication/repair authority. Then establish the pre-Priority-1 artifact baseline and a same-rubric before/after comparison.

## Merge discipline

This lane stays isolated from PR #398 and unrelated open PRs. Before promotion it must:

1. reconcile onto exact current `main`;
2. prove the diff is intentional and does not absorb other PR ancestry;
3. pass the dedicated Quality Intelligence calibration gate and applicable repository gates;
4. remain free of production mutation and autonomy/authority changes;
5. merge with an exact-head guard only after the protected candidate is green;
6. certify the merged-main state, not merely the feature branch.
