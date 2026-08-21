# Priority 2 — Quality Intelligence & Evaluation System

## Mission
Build an independent examination system for Content Worker artifacts. It measures curriculum fidelity, subject accuracy, teachability, pedagogy, classroom readiness, assessment quality, safety, source grounding, Kenyan feasibility, inclusion and teacher usability.

This lane does not build the Critic/Editorial Worker, repair content, publish content, approve releases, or increase Worker Engine authority/autonomy.

## Independence
Priority 1 may add worker-owned profiles, preflight, planning and evaluation telemetry. Those signals may be consumed as evidence but are never authoritative Quality Intelligence verdicts. The Content Worker cannot modify the sealed rubric or gold labels, and worker self-review cannot certify its own output.

## Production evidence inspected read-only
On 2026-08-21 production contained 6,050 `content_quality_snapshots`, 22 `publication_quality_current` rows, 3 `curriculum_authoring_drafts`, 12 worker-performance rows and 10 worker-certification rows. Existing metrics are evidence inputs, not assumed ground truth.

The three pre-Priority-1 source-grounded authoring drafts were frozen exactly with content hashes, structured-output hashes, evidence-packet hashes, model/authoring version and target lineage. They are content-patch outputs, not full Teacher Guides, so they are not falsely scored against a Teacher Guide classroom-readiness rubric.

## V1 evaluator
The Teacher Guide rubric has eleven weighted dimensions, dimension-specific minimums, an 85/100 certification threshold and hard blockers. A weighted average cannot hide unsafe practical work, material subject error, unsupported curriculum claims, fabricated grounding, unteachable required outcomes, materially wrong assessment answers or unresolved authoritative contradiction.

The evaluator is deterministic and has no Worker, publishing or repair capability. Its gold suite includes strong content, an unteachable required outcome, a plausible Chemistry error, unsafe practical work, fabricated grounding, a high-average critical-dimension failure, a classroom-readiness deficit and a threshold pass. CI requires 100% gold classification accuracy and zero false positives/false negatives for V1.

## Durable evidence
Every evaluation record uses explicit evaluator/rubric identity. The repository evidence ledger is append-only and hash-chained; CI rejects history rewrites. The V1 rubric and V1 gold labels are sealed after first merge. Improvements to the exam standard require a new version.

Before/after comparisons fail when rubric identity changes and surface every dimension regression rather than allowing a higher overall score to hide a weaker dimension. Evidence-packet identity may also be locked for controlled comparisons.

## Certification gates
Priority 2 is complete only when:

1. evaluator source compiles;
2. sealed gold calibration passes 8/8 with zero false positives and zero false negatives;
3. frozen production baseline content hashes and lineage verify;
4. evaluation ledger hash chain verifies;
5. independence contract verifies;
6. V1 immutability and ledger append-only CI contracts verify;
7. applicable repository integration/build gates pass;
8. candidate is exact-current-main with intentional isolated diff only;
9. merge is performed with an exact-head SHA guard;
10. merged `main` is rechecked and the dedicated Quality Intelligence workflow is green.

No production database mutation is required for this Priority 2 foundation. Runtime/database integration belongs to a later governed operationalization step and must preserve the same evaluator independence.
