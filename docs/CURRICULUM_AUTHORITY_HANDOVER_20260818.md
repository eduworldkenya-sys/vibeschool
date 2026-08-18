# Curriculum Authority recovery handover — 2026-08-18

## Mission

Recover the authoritative KICD/source ingestion architecture that PR #226 claimed to contain, without reintroducing superseded Reader code and without inventing school pacing.

## Recovery decision

PR #226's old head `45cf0c10ee1a407095ceb3139f9fa4f940ff33c1` was 92 commits behind current `main` and its six changed files were Reader harmonization only. Its description claimed a curriculum-source pipeline that was not present in the patch.

The repair intentionally rebuilds PR #226 from current `main` (`6b017d741012bf13e2e005fcdd0b2eb828900820`) as the curriculum-authority capability its body promised. The old Reader head SHA is retained here for archaeology; Reader Excellence has since advanced independently on `main`.

## Production investigation

Supabase production project: `yauqsxggtuxuykcbrtzf`.

Read-only findings:

- No `curriculum_authority_*` tables exist in production.
- `public.curriculum` is an operational/pacing table: `term`, `week`, `topic`, and `global_subject_id` are NOT NULL.
- `public.cbc_strands` is the existing curriculum hierarchy surface and already permits `term`/`week` to be NULL.
- Grade 9 already has 144 `cbc_strands` rows across 12 subjects, all currently unpaced.
- Those Grade 9 rows have no `source_ref` and no embedded `learning_outcomes`, so their existence is not evidence of authoritative KICD provenance.
- `curriculum_learning_outcomes` supports official outcomes linked directly by `sub_strand_id`; `curriculum_id` is not mandatory when `sub_strand_id` is present.

Therefore the source pipeline must reconcile to `cbc_strands`, not create fake NULL-pacing rows in `public.curriculum`.

## Authority architecture

`HQ-approved source → immutable artifact + SHA-256 → staging snapshot → normalized observations → seal/checksum → deterministic reconciliation → HQ review → HQ promotion`

Raw evidence tables are service-only. Browser roles receive no raw table privileges.

### Reconciliation classifications

- `exact_official`
- `missing_hierarchy`
- `missing_outcome`
- `creator_claimed_replacement_candidate`
- `official_conflict`
- `scope_mismatch`

Hierarchy matching is exact after normalization on canonical subject, grade, strand and sub-strand. No fuzzy match may become authority. Multiple hierarchy candidates are a conflict.

## Promotion rules

- HQ owner only.
- Recomputes sealed observation count and SHA-256.
- Requires complete reconciliation.
- Blocks scope mismatch, official conflict and missing hierarchy.
- Rechecks hierarchy identity and official code/text conflicts at promotion time.
- Inserts official outcomes against `cbc_strands.id` via `curriculum_learning_outcomes.sub_strand_id`.
- Existing creator-claimed rows are preserved as history; they are never rewritten or deleted.
- `public.curriculum` is never inserted or updated by source promotion.
- No term/week pacing is created by this migration.
- Migration installation seeds zero sources, artifacts, snapshots, observations, reconciliations, promotions or official outcomes.

## PR #228 implication

PR #228's original target (`public.curriculum`) is architecturally incorrect. Production already has an unpaced Grade 9 hierarchy surface in `cbc_strands`, while `public.curriculum` cannot represent unpaced rows.

After #226 is certified and merged, #228 must be reconciled into a source-proven **hierarchy binding/repair lane for `cbc_strands`**: reuse an exact unpaced row, create a missing unpaced `cbc_strands` row when source evidence proves it, fail on ambiguity, record lineage, invalidate reconciliation and require a fresh reconciliation before outcome promotion.

## Deployment boundary

Production Supabase remains read-only for this recovery. Repository merge is capability promotion only; production migration application and real KICD artifact intake are separate controlled steps.

Avoid intentional intermediate Vercel deployments. Consolidate repository updates at certification points.
