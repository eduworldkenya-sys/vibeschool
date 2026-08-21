# Quality Intelligence

Independent evaluation infrastructure for VibeSchool content artifacts.

## Rules
- The Content Worker does not own the rubric, gold labels, thresholds, or final verdict.
- Worker self-review and preflight are evidence only.
- Hard blockers cannot be averaged away.
- Rubric and suite identities are content-addressed with SHA-256.
- Before/after comparisons require the same rubric identity.
- Any dimension regression is surfaced even when the aggregate score improves.
- This package has no repair, publication, approval, or Worker Engine authority.

## Calibration
Run:

```bash
python scripts/quality_intelligence_evaluate.py --calibrate
```

The command must classify every sealed gold case correctly. CI treats any calibration failure as a failing examination system.
