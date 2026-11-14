# Grade 4 Mathematics Topic Practice 001 — controlled release

This is **original source material**, not a published assessment or a new assessment engine. Release key: `g4-mathematics-place-value-topic-practice-001`.

## Canonical flow

Curriculum Map outcome → EXQ assessment_definitions → five assessment_items with assessment_item_outcomes → one public_practice assessment_assignment → existing startOrResumeAttempt / saveResponse / submitAttempt → saved attempt, feedback RPC and results.

Existing learner page: `components/student/CanonicalTopicPractice.tsx`. Do **not** create a separate question bank, attempt store, score table, API, or marking routine. Keep `assessment_items.auto_marking_mode='option_match'` and `status='approved'` only after source/content review. Use `generation_metadata` for `topic_practice: 'true'`, `grade: 'Grade 4'` and a stable `topic`. Require exactly five approved MCQs and an untimed, open public practice assignment with immediate results.

## Release blocker discovered 14 November 2026

The active VibeSchool outcome candidate `c600f693-6242-45b3-b6f2-0211447e579c` had `source_type='creator_claimed'`, `verified_at IS NULL`. The official-source outcomes located in the Grade 4 Mathematics legacy curriculum record were draft, and the other comparable outcomes were archived, some marked synthetic tests. **Do not link or publish against draft, archived, synthetic, or unverified outcomes just to make the practice appear live.** Reconcile the authoritative curriculum hierarchy through its existing verification workflow first.

## Before production publication

1. Resolve the verified authoritative Grade 4 Mathematics Whole Numbers outcome, and record its true ID and provenance. Confirm strand/sub-strand and scope against current KICD Grade 4 Mathematics.
2. Confirm database constraints, permissions, owner authorisation and the existing approved EXQ release process. Check for duplicate releases by `release_key`; use transactional, idempotent writes.
3. Create a single EXQ practice definition, five ordered approved MCQ items with options keyed A–D, JSON string correct answers, explanations, and five `assessment_item_outcomes` references to the verified outcome; publish through the canonical approval/assignment workflow, not a parallel table.
4. Verify the canonical topic-list RPC discovers exactly one five-question untimed Grade 4 Mathematics topic and does not expose correct answers before answering.
5. Execute an independent-learner end-to-end test: open, answer correct/incorrect, skip, refresh/resume, submit, immediate score, mistakes review, results persistence and fresh attempt. Confirm existing exam flows unaffected.
6. Record the assignment ID, assessment ID, outcome ID, verification evidence and production deployment URL before marking published.

## Content quality

The companion JSON contains five original VibeSchool questions with one unambiguous answer, grade-appropriate values, and immediate explanations. Source questions remain staged; this JSON must **not** be loaded by a parallel learner runtime.
