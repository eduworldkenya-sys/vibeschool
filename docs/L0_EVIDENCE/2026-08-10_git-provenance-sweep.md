# L0 Git Provenance Sweep — 2026-08-10

**Status:** Evidence captured; no reconciliation SQL authorized.
**Branch:** `agent/worker-engine-freeze-l0`
**Safety:** GitHub/repository inspection only. No production writes.

## Objective

Test the hypothesis that the missing pre-ledger foundation, especially the synthetic `20260520000000_timetable_foundation_baseline`, can be recovered directly from repository history before querying production for reconstruction.

## Evidence checked

1. Current repository search for `20260520000000_timetable_foundation_baseline.sql` returned no indexed file.
2. Repository search for `20260520000000` found reconciliation records documenting the version as a live-only synthetic baseline, but no current migration file.
3. Issue #65 explicitly records `20260520000000_timetable_foundation_baseline` as a live-only synthetic baseline and states that production contains pre-ledger core tables including `profiles`, `schools`, `classes`, `subjects`, `teacher_classes`, and `timetable_slots`.
4. Issue #65 also records that the blank rebuild fails at `20260521083057_report_schedules.sql` because `public.schools` does not exist.
5. Commit search for `baseline` found unrelated baseline-history commits, including `scheme_lesson_resource_links`; it did not surface the missing timetable foundation as a recoverable current file.
6. Commit search for `schools` confirms many later application/schema changes reference school context, but does not by itself prove that the missing pre-ledger `schools` DDL survives in Git history.

## Interpretation

The Git provenance sweep **does not yet recover the missing foundation SQL**. The documented fact that `20260520000000` is live-only is strong evidence of a missing repository source, but absence from the current GitHub search index is not proof that Git object history has been fully exhausted.

Therefore:

- Do not invent `schools` DDL.
- Do not create `baseline_schools.sql`.
- Do not choose baseline-vs-replay yet.
- Proceed to authoritative production catalog evidence and dependency analysis if a direct Git object-history path cannot be inspected.

## Current recovery loop

`GIT PROVENANCE → INCONCLUSIVE → PRODUCTION CATALOG → DEPENDENCY CLOSURE → DERIVED MINIMUM FOUNDATION → LOCAL REPLAY → CAPTURE → EXPLAIN → REPLAY`

## Evidence references

- Issue #65: `Reconcile Supabase migration history and reconstruct the missing foundation`.
- Current L0 evidence document: `docs/L0_RECOVERY_EVIDENCE_2026-08-10.md`.
- Migration classification: `supabase/reconciliation/migration_classification.md`.

## Decision

**L0 remains RED. Worker Engine coding remains BLOCKED.**

The next authorized evidence task is the current production catalog/dependency snapshot plus repository reference extraction. No production mutation is permitted.
