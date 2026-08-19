# VibeSchool Task 20 — Pilot Content Readiness Handover

Date: 2026-08-19
Branch: `task/20-pilot-content-readiness-20260819`
Starting main: `77051a4011d7712a275f76af41efed382f017398`
Production Supabase: read-only inspection only
Production publication/deployment: blocked by shared-foundation hold gate

## Mission state

Task 20 is **in progress / hold-gated**, not production-certified.

The branch is intentionally production-disconnected. No production rows, migrations, RLS, grants, Edge Functions, content publications, feature flags or Vercel configuration were changed.

## Current architecture confirmed

- `vibe_publications` is the publication authority for VibeTextbooks.
- `vibe_chapters` is the structured textbook chapter/content authority.
- `vibelearn_content` is a learner-facing discovery/index layer.
- `vibe_reading_progress` preserves chapter-level reading position/progress.
- `vibelearn_completed` stores completion evidence for VibeLearn discovery content.
- `learning_resources` is the canonical reusable content family root.
- Canonical R3 on current main adds immutable `learning_resource_versions` and exact contextual version pins, but the production database does not yet contain `learning_resource_versions`.
- Existing publication reconciliation maps published VibeTextbooks into `vibelearn_content` and maps non-published textbooks to draft.
- Existing learner RLS exposes `vibelearn_content` rows when `status = 'live'` (or to their submitting author), preventing ordinary learners from discovering unrelated draft rows.

## Production starting inventory — read-only evidence

### Learner discovery inventory

`vibelearn_content` currently contains:

| Status | Type | Count |
|---|---:|---:|
| live | textbook | 5 |
| live | ebook | 1 |
| live | epage | 1 |
| draft | textbook | 1 |

Total learner-facing live rows: **7**.

### Publication inventory

`vibe_publications` currently contains:

| Status | Format | Count |
|---|---:|---:|
| published | vibetextbook | 5 |
| published | ebook | 1 |
| published | vibepress | 3 |
| draft | vibetextbook | 12 |
| draft | vibepress | 1 |

### Published content identity findings

All seven currently live `vibelearn_content` rows have `subject_id = NULL`.

The live set includes:

- a Grade 1 English test ebook;
- an epage titled `Maths grade 4 test content` with no publication identity and no URL;
- Form 1 Chemistry with no declared grade/subject metadata on its publication;
- Form 4 Chemistry with `cbc_subject = science` rather than the canonical Chemistry subject;
- two independently published Grade 9 Pathways books with the same title;
- a Form 4 Biology textbook with explicit `KCSE 8-4-4` framework metadata.

These rows are inventory evidence only. Row count is not content-readiness certification.

### Chapter readiness findings

Production `vibe_chapters` includes:

- 7 published chapters with `alignment_status = creator_claimed` and learning outcomes present;
- 10 published chapters with `alignment_status = unclaimed`, all 10 without learning outcomes;
- 91 draft chapters with creator-claimed alignment;
- 6 draft unclaimed chapters, 5 without learning outcomes.

No production chapter observed in this first inventory is yet in an `approved` or `verified` alignment state.

## Initial pilot matrix

This matrix describes current evidence, not final pilot scope approval.

| Cohort / route | Current asset evidence | Current readiness |
|---|---|---|
| Grade 1 English | 1 live test ebook, one chapter | RED — test-labelled content; canonical subject link absent |
| Grade 4 Mathematics | 1 live test epage | RED — no URL, canonical subject link absent, not a complete learning path |
| Grade 9 Pathways / Mathematics | 2 live same-title textbooks, one with 8 chapters | AMBER/RED — duplicate conceptual discovery, canonical subject link absent, alignment must be verified |
| Form 1 Chemistry | 1 live one-chapter textbook | RED — publication grade/subject metadata absent |
| Form 4 Chemistry | 1 live two-chapter textbook | RED — subject metadata is `science`, not canonical Chemistry |
| Form 4 Biology | 1 live four-chapter textbook | AMBER — strongest existing flagship candidate; still requires approved curriculum mapping, exercise/assessment connection, renderer/mobile/resume E2E and legal provenance confirmation |

Current best flagship candidate: **Form 4 Biology**, because it has explicit level, explicit Biology subject metadata, KCSE framework identity and multiple chapters. It is not yet certified.

## P0 / P1 findings

### P0-20-01 — Production canonical version schema lag

Current main contains Canonical Learning Assets R3, but production does not contain `learning_resource_versions`. Final Task 20 exact-version/progress certification is blocked until shared foundation commissioning reconciles production to current main.

### P0-20-02 — Publication gateway does not enforce pilot readiness

The historic `publish_textbook(uuid)` authorizes the author and flips lifecycle state, but it does not require canonical subject identity, level identity, learning outcomes, approved curriculum alignment or stable curriculum/sub-strand mapping before publication.

Branch fix prepared: `20260819081100_task20_pilot_content_publication_guard.sql`.

### P1-20-01 — Live discovery rows lack canonical subject IDs

All seven live discovery rows currently have `subject_id = NULL`. This prevents reliable curriculum-structured discovery and forces title/free-text interpretation.

### P1-20-02 — Test/placeholder material is live

At least two live rows are explicitly test-labelled; the Grade 4 Mathematics epage also has no URL.

### P1-20-03 — Published chapters can have unclaimed alignment and no outcomes

Ten published chapters are `unclaimed` and have no learning outcomes. That is incompatible with the Task 20 definition of curriculum-linked, meaningful pilot content.

### P1-20-04 — Duplicate conceptual discovery exists

Two live Grade 9 Pathways textbooks share the same title but point to separate publication identities. Their educational/version relationship must be reconciled before exposing a flagship route.

## Changes prepared on Task 20 branch

### 1. Fail-closed textbook publication validator

Added `public.content_validate_textbook_publication(uuid)`.

The validator rejects publication readiness when any of the following is true:

- wrong format;
- missing title;
- missing description;
- missing curriculum framework;
- missing grade/form;
- missing subject;
- subject has no unique platform-level canonical identity;
- no chapters;
- any chapter is not published;
- chapter body is empty/malformed;
- chapter has no learning outcomes;
- alignment is not `approved` or `verified`;
- curriculum identity is missing;
- sub-strand identity is missing.

### 2. Publication gateway hardened

`publish_textbook(uuid)` now calls the readiness validator **before** changing publication state. Validation failure raises and prevents the publication/index side effect.

Authorization remains author-only. Anonymous execution is revoked.

### 3. Permanent verification SQL

Added `scripts/sql/task20_pilot_content_publication_guard_verify.sql` to verify:

- validator/gateway existence;
- anonymous denial;
- expected authenticated execution contract;
- pinned `search_path` on security-definer functions;
- validation occurs before publication UPDATE;
- required readiness checks remain present;
- missing-publication validation fails safely without mutation.

## Shared-foundation dependencies

1. Canonical Learning Assets R3 is merged into repository main but not yet commissioned into production.
2. Student/VibeLearn exact-current-main state may continue to change under Tasks 1/5/10 and must be reconciled before final Task 20 certification.
3. Authorization Task 8 must remain authoritative for final production grants/RLS verification.
4. Task 18 HQ operating-system work may alter where content-health and gap-queue operations surface.

## Required next loop while hold-gated

1. Build disposable-DB CI for the Task 20 migration and verifier.
2. Add a read-only pilot-content health query that classifies live rows as ready / metadata-only / test / broken / curriculum-unverified.
3. Establish canonical discovery mapping from publication/content to curriculum + level + platform subject without relying on title strings.
4. Add governed content-gap queue contract.
5. Select Form 4 Biology as provisional flagship and validate every chapter block, outcomes, media, exercises/assessment references and renderer behavior.
6. Audit Grade 4 Mathematics live test epage and ensure it cannot remain prominently exposed as complete content.
7. Reconcile duplicate Grade 9 Pathways discovery identities.
8. Add VibeLearn renderer regression coverage for no-URL/broken asset behavior.
9. Add Android/low-bandwidth checks around the exact flagship route.
10. Add exercise → answer → feedback → evidence checks for the flagship pathway.
11. Add copyright/licensing provenance classification before any intended publication.

## Final certification gate

Task 20 may not be marked complete until shared foundations merge/commission and the exact candidate is re-synchronized with current main, production is re-inspected read-only, migrations/contracts are reconciled, content validators pass, flagship Student E2E passes, Android/low-bandwidth checks pass, security/build gates pass, and production publication + production Student E2E are deliberately executed under the Production Publication Gate.
