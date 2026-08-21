# Quality Intelligence

Quality Intelligence is VibeSchool's independent examination layer for educational content. It is deliberately separate from Content Worker generation and self-review.

## V1 guarantees

- a versioned 11-dimension Teacher Guide rubric;
- non-averagable blockers for curriculum, subject, safety, evidence and assessment failures;
- sealed evaluator calibration cases;
- deterministic scoring and before/after comparison;
- exact rubric and suite SHA-256 identities;
- frozen pre-Priority-1 production Worker artifacts with content and lineage hashes;
- an append-only, hash-chained evaluation evidence ledger;
- CI enforcement that prevents V1 rubric/gold labels being silently edited after merge;
- no publication, repair, Worker Engine authority or runtime capability.

## Commands

```bash
python scripts/quality_intelligence_evaluate.py --calibrate
python scripts/quality_intelligence_evaluate.py --verify-baseline
python scripts/quality_intelligence_evaluate.py --verify-ledger
python scripts/quality_intelligence_evaluate.py --input evaluation.json
python scripts/quality_intelligence_evaluate.py --compare-before before.json --compare-after after.json
```

A Content Worker preflight or self-review may be attached as evidence, but it cannot become the independent verdict. A new rubric standard must be introduced as a new version rather than editing a sealed historical version.
