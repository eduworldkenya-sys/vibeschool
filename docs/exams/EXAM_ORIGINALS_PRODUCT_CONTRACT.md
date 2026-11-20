# VibeSchool Exam Originals — Approved Product Contract

Owner decision: 15 November 2026. Status: accepted product intent; rollout staged. This document records decisions, not publication or certification of any paper.

## One department, five products

VibeSchool Exams remains the student entry point; Topic Practice remains under Learn.
The five product series are:
- **VibeCAT** — continuous assessment; 30-question default.
- **VibeTry** — short trial exams; 10–15-question default.
- **VibeTerm** — Term 1/2/3 curriculum-grounded examinations; 50-question default.
- **VibePapers** — broad original revision papers; 50-question default.
- **VibeMock** — original national-assessment simulations using the applicable paper-specific structure, timing, sections and marks.

These are VibeSchool-authored originals, never presented as official KNEC papers. No past-paper dependency. An edition year does not imply KNEC endorsement.

## Reuse canonical assessment architecture

Reuse existing `assessment_definitions`, `assessment_items`, `assessment_assignments`, `assessment_attempts`, `assessment_responses`, `assessment_item_outcomes`, marking authority, learner result/release policy and gradebook. Do not create a parallel exam engine or duplicate assessment/result authorities.

This first slice adds a **read-only catalogue** via `lib/assessment/exam-originals.ts`. An assignment displays in an Originals series only when canonical learner-assignment discovery returns a recognised **server-authoritative `original_product_series` code**. The current RPC does not yet return this code, so the new series show honest empty states until approved Originals inventory and its guarded metadata contract are shipped. Legacy assessments remain available in All exams. A matching title alone **must never certify authorship or quality**.

Never mint inventory or show a fictional 'ready' paper. Only learner-authorized discoverable assignments are shown. Unbranded legacy exams remain accessible.

## Canonical question requirements for production

Each of the initial 100 complete VibePapers examinations should have 50 original questions, a checked answer key, concise explanations, marking scheme, age-appropriate worked solutions for maths and other procedural tasks, grade/subject/strand/topic, verified outcome mapping when available, cognitive demand, skills tested and plausible distractors. Link to a VibeSchool lesson optionally, but do not fabricate curriculum outcome IDs or links. Validate the applied curriculum and source.

Cognitive demands vary by grade, subject and blueprint (remember, understand, apply, analyse, evaluate, create). Difficulty is separate. The 50-question target is a **VibeSchool revision format**; mock format follows the relevant national assessment blueprint rather than forcing 50 questions.

## Settings and result integrity

Use existing fields for time limits, attempt limits, question/option randomisation, score release, answer-review policy, explanations and worked solutions. Authoritative policies must remain server-enforced. Formal results must never be exposed before authorised release.

MCQ and compatible objective items are system-marked. The existing submission code supports `numeric_tolerance` for numerical answers, but production authoring, input variants, unit handling and full end-to-end certification require a dedicated check. Do not treat mere presence of the marking mode as proof that every numeric question is handled safely.

For explanations, descriptions, diagrams and essays, prepare **short, criterion-based marking schemes** with alternative acceptable points before publication. The learner first submits and locks their original answer; when answer-review policy allows, they may self-award marks criterion-by-criterion. Store self-awarded marks separately from system-verified marks, with an option for 'Not sure'. No teacher or AI marking is assumed. Never claim the combined score is fully verified or confer mastery solely from self-awarded marks.

## Staged implementation

1. Catalogue and visual brands: product registry, responsive five-brand selection, honest inventory, legacy compatibility and regression checks.
2. Canonical product metadata: explicit series/edition/paper identifiers in the existing assessment model, with learner discovery, access control and migration/rollback proof.
3. Marking: certifiable numeric answer input, criterion-based self-marking after secure release, provenance/gradebook separation, negative-path tests.
4. Content: paper 001 verified against the applicable KICD curriculum; then batches of 20 to the 100-paper target, with tests for quality, originality, objective grading and release correctness.

Publication, payments and scheduled generation require separate owner authorisation and evidence. This rollout does not activate them.

## Guided learner review implementation (Phase 2 — scoped)

The learner assessment player supplies a focused numerical input for `numeric` question types while **all scoring remains on the canonical server**. `numeric_tolerance` already exists in the official submission RPC; no arbitrary units or free-text compositions are silently coerced into correct numbers.

Released learner-owned attempts may load short **point-form criteria** from the pre-authored `assessment_items.marking_guide`. Only the existing answer-review policies `after_release` and `after_close` (after close) allow disclosure. A valid scheme uses:

```json
{"criteria":[
  {"id":"evaporation","label":"Water evaporates when heated.","marks":1},
  {"id":"condensation","label":"Water vapour cools and condenses.","marks":1}
]}
```

Criterion IDs must be unique; marks positive and the sum not greater than the assessment item's max marks. Legacy string lists and inconsistent marking guides do not enable scoring. New reviews are **learner self-awarded, not verified**. The submitted answer is locked; saved self-score, selected IDs and uncertain status are separate fields on the canonical response, never modifying its `final_score`, the attempt's grade or gradebook.

**Current hard boundary:** The new UI opens from an already **released** learner result. Existing written responses that still await teacher review remain unreleased; this slice does not bypass their release embargo or activate automatic publication. A further separately certified journey is required for learner-only self-review immediately after an otherwise unmarked practice submission. Do not label a partially marked score as verified.

## Learner-only immediate practice and verified catalogue integration (Phase 3)

- A submitted `practice` attempt with `show_score_policy=immediate`, `result_status=partially_marked`, and a permitted answer-review policy may access `exq_get_my_practice_self_review`. Every RPC rechecks canonical learner ownership, submission lock, assessment type and answer visibility.
- It displays the original response, server-verified objective marks, and a point-form learner self-marking rubric. The learner may save criteria or select 'Not sure' independently; no teacher or AI is required for this **unverified practice feedback**. Formal exams and embargoed answers remain fail-closed.
- Self-marks are stored on the existing assessment response, never in `final_score`, `assessment_attempts.score`, or the teacher gradebook. Unreviewable free-text items remain unverified; a combined self-assessed score is not displayed until each written response is reviewed.
- A paper may claim VibeCAT/VibeTry/VibeTerm/VibePapers/VibeMock only through `hq_certify_exam_original_assignment`, which requires an active platform owner, approved items, topic/outcome links, original marking evidence, explanatory content, exact product-specific question counts, and no existing attempts. The separate metadata table has RLS enabled, no direct anon/authenticated grants, and no policies; read access is only through the existing learner-authorized `exq_list_my_assignments` RPC.
- Default catalogue inventory remains **empty and honest** until an original paper passes full editorial certification and owner registration. No past papers, invented paper links or automatic publishing are enabled by these migrations.

### Deployment order and rollback

Apply the existing, unapplied `20261115040500_exq_learner_self_review.sql`, then `20261115062000_exq_practice_immediate_guided_review.sql`, then `20261115063000_exam_originals_catalogue_identity.sql` (subject to current production migration ledger and exact-head CI). The catalogue migration does not automatically certify any assignment. Deactivation can be achieved by revoking execute on the three new user-facing functions and the owner certification function without touching canonical scores or attempts. Existing self-marks can be retained for provenance.

Production database activation requires separate verification of SQL grants, learner ownership, review embargo, and authenticated UI behaviour. Passing isolated CI does not mean a real learner paper has been published.

## Interim practice inventory — owner-directed release, 20 November 2026

The Grades 5–8 recovered VibeTerm volumes are usable as general revision practice papers while the term-sequenced scheme is unavailable. Their learner-facing title and instructions explicitly state that term scope is pending; they must not be represented as verified Term 1, 2 or 3 examinations. VibeMock volumes in the recovery batch are 40-item VibeSchool practice simulations, not certified national-assessment blueprints or official papers. Publish only through the existing owner-directed automated practice route after arithmetic, integrity, access, marking and embargo verification; preserve provisional curriculum provenance and private answer keys. The intended formal product standard above remains unchanged. No human editorial or KICD/KNEC endorsement is asserted.
