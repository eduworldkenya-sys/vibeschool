# Grade 4 Mathematics Content Factory — Batch 01, Addition 1.2(a)

**Date:** 2026-11-14 (Africa/Nairobi)  
**Status:** EDITORIAL DRAFT ONLY — NOT CERTIFIED, NOT IMPORTED, NOT PUBLISHED, NOT LEARNER-TESTED  
**Scope:** ONE of the outcomes within 1.2 Addition, NOT the entire sub-strand, its 8 lessons, or Grade 4 Mathematics.

## Evidence and current reuse

1. **KICD source:** [Grade 4 Mathematics, revised 2024, regular curriculum](https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf), printed pp. 4–5. Strand 1.0 Numbers, sub-strand 1.2 Addition, first outcome: adding two four-digit numbers with one regrouping, sum no greater than 10,000. Source text observed against the KICD-hosted PDF, not promoted through the authenticated `curriculum_authority_*` pipeline. The visually accessible PDF screenshot service returned a cache miss, so the source-page visual inspection remains pending. Source document metadata and section table were text-inspected; no invented hash/approval.
2. **Existing catalog:** `lib/teaching/grade4MathematicsCatalog.mjs` already defines high-level original guidance for 1.2. The new manuscript extends that subject scope without changing the catalog's canonical identity.
3. **Place-value prerequisite:** Reuse the existing original editorial draft `content/curriculum/production/grade4-original-first-lessons.v1.json#VS-G04-MA-1.1-L01` for prerequisite instruction; **do not duplicate** its questions or pretend it is published. See `docs/curriculum/reconciliation/grade4-mathematics-1.1a-evidence-20261112.md`.
4. **Canonical draft publication:** `2745c031-65be-47de-bd75-1e1db74d4123` remains a **draft**. Existing Grade 4 Mathematics reader resources include 12 certified public Time learner-note versions, but these are distinct outcomes and **not** substitutes for Addition.
5. **Production DB:** `curriculum` has 39 Grade 4 Mathematics weekly records; its “Operations / Addition” row is a scheduling/topic reference, **not** proof of a verified KICD 1.2 outcome. The 21 outcomes joined to the Grade 4 Mathematics place-value curriculum row contain 11 draft and 10 archived; no verified/active 1.1 outcomes there. `curriculum_authority_sources` has no approved Grade 4 Mathematics source entry at inspection time.
6. **Canonical assessment:** A Grade 4 Mathematics place-value Topic Practice assessment is already published. The 1.2(a) draft's five self-checks have **not** been added to the question bank, assigned, or released.

## Package delivered

- `content/curriculum/production/grade4-mathematics-addition-1.2a.v1.editorial.json`
- `content/curriculum/production/visuals/grade4-addition-1.2a-regroup.svg`

The original package provides: scope and source locator; prerequisites; learner explanation; a five-step reasoned model; two guided checks; hands-on, low-cost and independent activity; three independent exercises; five formative checks with explanations and misconception feedback; revision flashcards and recall; remedial and enrichment support; teacher assessment checklist and accessibility alternatives. The editable SVG diagram uses labelled columns and a text explanation, not colour as the only signal.

## Editorial arithmetic validation performed

Ten numeric items (one worked model, one numeric guided item, three independent exercises, five formative questions) checked by authoring code to ensure:
- `operandA + operandB = expected answer`;
- exactly **one** base-ten regroup occurs;
- each total is **at most 10,000**.

The correct sums include 2,413 + 1,258 = 3,671; 3,418 + 2,257 = 5,675; 4,526 + 1,307 = 5,833; 5,608 + 2,145 = 7,753; 6,412 + 1,269 = 7,681. The SVG carries one ten from ones into tens; it is an editorial candidate, not a certified visual asset. These authoring checks are **not** independent educational review or repo CI.

## Source reconciliation blocker / crosswalk

`curriculumOutcomeId` intentionally remains `null`: the first KICD 1.2 Addition outcome has not been verified and promoted through the existing curriculum-authority source/snapshot hierarchy. **Never substitute** the local weekly `curriculum.id`, a draft place-value outcome, a manuscript alias or an invented UUID.

Before the packet can be imported and published:
1. Authenticated source intake: register actual official 2024 regular-design artifact, record immutable bytes/checksum and exact pp. 4–5 source observation. Resolve any differences between editions or adaptations.
2. Reconcile Numbers → Addition to existing canonical subject / sub-strand / outcome authority and retain legacy teacher Scheme references intact.
3. Independently review the pedagogy, mathematics, answer keys, accessibility, source scope and visual as required; correct and version the draft rather than changing certified content.
4. Create/reuse the existing canonical `learning_resources` root and immutable candidate `learning_resource_versions`, attach verified `curriculum_outcome_id`, and apply current certification and release gates. Do not build a parallel Content Engine or assessment service.
5. Publish only via existing authorised workflow. Verify the independent learner can read the lesson, complete topic practice, see correct feedback, and view saved progress.

**Access status:** Connected tools permit GitHub editorial commits and read-only production DB inspection. An authenticated owner source-intake/independent certification/publication capability was not supplied here. No privileged SQL substitute has been used and no production data mutated.

## Next batches

- **1.2(b)** double regrouping, sum ≤ 10,000.
- **1.2(c)** round-to-ten estimates of sums.
- **1.2(d)** addition patterns through 10,000.
- **1.2(e)** everyday total-quantity applications.
- Resolve and repair the existing **1.1(a)** place-value draft and five-column visual without duplicating its previously drafted and published assessment objects.

A new specialist chat should read this handoff and current GitHub/DB truth before taking the next scoped batch. Candidate manuscript counts must never be described as a complete sub-strand or book.
