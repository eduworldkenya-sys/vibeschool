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

This first slice adds a **read-only catalogue** via `lib/assessment/exam-originals.ts`. An assignment displays in an Originals series only if its approved title explicitly begins with that series name; otherwise it stays in the existing Exam Library. Naming alone **does not certify question quality**. This is a compatibility fallback pending approved, explicit series metadata in the existing assessment contract.

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
