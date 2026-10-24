# VibeSchool Form 4 English — Production Manifest

Date: 2026-08-28

## Mission

Build the Form 4 / KCSE English learner system as a skill graph rather than a chapter-note dump. The production architecture covers Language, Reading, Writing, Oral Skills, Literature, Set Texts, KCSE Paper Labs, Revision and Teacher OS derivatives.

## Production publication

- Publication ID: `e8440000-0000-4000-8000-000000000101`
- Title: `Vibe English Form 4`
- Format: `vibetextbook`
- Status: `published`
- Framework label: `KCSE 8-4-4`
- `cbc_aligned`: `false`
- Canonical curriculum subject: global `English`
- Curriculum architecture rows: 28
- Learner units: 28
- Structured learning blocks: 361 after repair
- Actual learner-facing text after metadata recount: approximately 20k words
- Every unit contains a mastery checkpoint and Teacher OS derivative.
- Every unit contains diagnostic/misconception-aware practice; oral units explicitly tag audio-dependent activities.

## Unit map

1. KCSE diagnostic and score strategy
2. Sentence structure, phrases and clauses
3. Concord / subject–verb agreement
4. Tense, aspect and voice
5. Direct and reported speech
6. Conditionals, question tags and transformations
7. Punctuation, spelling, vocabulary and register
8. Editing and error diagnosis
9. Functional writing I
10. Functional writing II
11. Narrative composition lab
12. Description, argument and exposition
13. Comprehension I
14. Comprehension II
15. Oral skills: sounds, stress and intonation
16. Oral skills: listening, etiquette and public speaking
17. Oral literature
18. Poetry
19. Prose and drama analysis
20. `Fathers of Nations`
21. `The Samaritan`
22. `A Silent Song and Other Stories`
23. `An Artist of the Floating World`
24. `A Parliament of Owls`
25. KCSE Paper 1 Lab
26. KCSE Paper 2 Lab
27. KCSE Paper 3 Lab
28. Adaptive 7-day / 14-day / 30-day revision pathways

## Authority status

### Verified examination authority

KNEC 2024 KCSE Regulations have been checked for the English paper structure used by the 2026 KCSE cohort:

- Paper 1: 2 hours, 60 marks — Functional Writing 20, Cloze 10, Oral Skills 30.
- Paper 2: 2.5 hours, 80 marks — Unseen Comprehension 20, Compulsory Set-text Excerpt 25, Poetry/Oral Literature 20, Grammar 15.
- Paper 3: 2.5 hours, 60 marks — Imaginative Composition 20, Compulsory Set-text Essay 20, Optional-text Essay 20.

### Set-text cohort

The 2022–2026 set-text cohort has been corroborated from reproductions/reporting of Ministry circular `MOE/QAS/A/5/19.(35)`, dated 7 January 2022:

- Compulsory novel: `Fathers of Nations`
- Compulsory play: `The Samaritan`
- Optional anthology: `A Silent Song and Other Stories`
- Optional novel: `An Artist of the Floating World`
- Optional play: `A Parliament of Owls`

The original Ministry/KICD circular artifact is not yet attached to the VibeSchool authority store, so these nodes remain `creator_claimed` rather than certified authority bindings.

### Curriculum authority gap

The exact authoritative legacy secondary English syllabus artifact for the Form 4 / 8-4-4 cohort has not yet been ingested and hashed into the authority system. Consequently the publication intentionally remains `cbc_aligned=false` and chapter alignment remains `creator_claimed`.

## Learning-system evidence

The corpus was built with the VibeSchool loop:

`ORIENT -> TEACH -> WATCH THE EXPERT -> TRY -> CHECKPOINT -> DIAGNOSE -> CONNECT -> KCSE MODE -> MASTERY`

Implemented patterns include:

- worked modelling rather than definitions alone;
- misconception-targeted checkpoint metadata;
- practice ladders and transfer tasks;
- functional-writing purpose/audience/register analysis;
- composition planning, plot/argument architecture and editing;
- evidence-based comprehension reasoning;
- oral activities tagged `AUDIO_REQUIRED`, `AUDIO_RECOMMENDED` or `TEXT_SUFFICIENT` where relevant;
- literature `evidence -> interpretation -> significance` reasoning;
- copyright-safe set-text teaching using summaries, event maps and analysis rather than reproduced protected text;
- dedicated Paper 1, Paper 2 and Paper 3 environments;
- adaptive revision and Teacher OS remediation guidance.

## Runtime evidence

- Supabase canonical public-reader function `get_public_vibetextbook_reader(publication_id)` returns the publication and all 28 chapters successfully.
- Vercel production project is READY and `vibeschool.co.ke` is configured as a production domain.
- External HTTP validation of the textbook route returned `403` from the verification environment. The learner-facing route therefore remains **unverified**, even though the reader data path passes.

Canonical route target:

`/read/textbook/e8440000-0000-4000-8000-000000000101/e844c001-0000-4000-8000-000000000001`

## Independent critic / release decision

**State: NEEDS_REPAIR**

This publication must not be labelled `CERTIFIED` yet. The production loop explicitly forbids equating seeded rows or an opening publication with a completed learning product.

### Blocking gaps before certification

1. Bind and hash the authoritative legacy English syllabus/curriculum source and prove 100% requirement coverage.
2. Attach/verify the original 2022 set-text Ministry/KICD circular in the authority store.
3. Resolve or explain the public-reader `403` and verify the actual learner route anonymously.
4. Produce the audio assets required by oral-skills checkpoints and run listening/pronunciation runtime tests.
5. Deepen thin units beyond the current ~20k-word corpus where the independent critic finds insufficient modelling, answer feedback, practice depth or exceptions.
6. Expand full assessment/item banks, parallel retries and mocks rather than relying only on embedded checkpoint prompts.
7. Complete prescribed-text evidence/chapter/scene progression verification against legitimate copies, especially the anthology, without copying protected text.
8. Derive and validate the full Teacher OS scheme/lesson/assessment outputs from the canonical graph.
9. Run per-unit rubric scoring, fact/copyright review, adversarial learner tests and re-critic until every mandatory gate passes.

No P0/P1 release failure should be waived merely to call the content complete.
