# Curriculum hierarchy binding handover — 2026-08-18

## Corrected mission

PR #228 no longer writes source hierarchy into `public.curriculum`. Production investigation proved that table is operational/pacing-oriented and cannot represent unpaced rows because term/week/topic are required.

The canonical unpaced hierarchy surface is `public.cbc_strands`. Grade 9 already has 144 rows across 12 subjects, but those rows have no source provenance. Source ingestion must therefore **bind** official evidence to an exact existing hierarchy row or create a missing exact row without pacing.

## Authority chain

`approved source → immutable artifact → sealed snapshot → deterministic reconciliation → HQ hierarchy binding → fresh reconciliation → official outcome promotion`

Hierarchy binding processes every distinct hierarchy represented by the snapshot, not only missing rows. This gives existing Grade 9 rows explicit source lineage when they match official evidence.

## Rules

- HQ owner only.
- Exact canonical subject + grade + strand + sub-strand identity.
- Only `term IS NULL AND week IS NULL` rows qualify as source hierarchy.
- Zero matches: insert `cbc_strands` with NULL term/week and source_ref from the artifact.
- One match: reuse without rewriting the pre-existing row; lineage proves the new source binding.
- More than one match: fail closed as ambiguous.
- Bindings retain artifact SHA-256 and snapshot SHA-256.
- Any new binding deletes reconciliation and returns the snapshot to `sealed`, forcing fresh reconciliation.
- A BEFORE INSERT trigger on `curriculum_authority_promotions` rejects official promotion unless the target hierarchy is source-bound to the same snapshot/artifact evidence. The whole promotion transaction rolls back on violation.
- `public.curriculum` is never inserted or updated.

## Production boundary

No production database mutation in this branch. #226 must merge first. Then #228 should be reconciled onto that merged main, certified on the exact head, and merged. Real KICD artifact intake remains a separate controlled production operation.
