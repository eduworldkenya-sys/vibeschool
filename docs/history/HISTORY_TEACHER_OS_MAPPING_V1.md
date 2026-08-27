# VibeSchool History → Teacher OS Mapping Contract v1

Status: candidate contract; not production-certified.
Scope: Form 4 History & Government (8-4-4/KCSE), beginning with Topic 24.0.0 World Wars.

## Principle
Curriculum authority and learner presentation are separate. Teacher OS must never infer curriculum identity from display labels alone. Stable curriculum identifiers flow through every downstream artifact.

Canonical chain:

`Curriculum authority → content section → VibeSchool learner unit → scheme allocation → lesson plan → teaching session → assessment/evidence → reflection/progress`

## Identity carried downstream
Every generated or manually-authored Teacher OS artifact must retain, where applicable:

- `subject_identity`: History & Government (8-4-4/KCSE)
- `form`: Form 4
- `curriculum_topic_code`: e.g. `24.0.0`
- `curriculum_topic_title`: World Wars
- `curriculum_content_code`: e.g. `24.2.1`
- `curriculum_content_title`: First World War
- `curriculum_leaf_code`: e.g. `24.2.1(a)`
- `curriculum_leaf_title`: Causes
- `objective_code`: e.g. `24.1.0(a)`
- `objective_text`: authoritative objective text from the verified curriculum authority record
- `curriculum_outcome_id`: canonical DB outcome identifier once verified/bound
- `curriculum_node_id`: canonical hierarchy identifier
- `content_artifact_id` and version when certified content is attached
- `assessment_bank_version` when questions are attached

Display labels such as `Chapter 1` or `Lesson 1` are presentation metadata only and must never replace these identifiers.

## World Wars mapping matrix

| Curriculum topic | Content section | Leaf / learner lesson | Objective | Teacher OS use |
|---|---|---|---|---|
| 24.0.0 World Wars | 24.2.1 First World War | (a) Causes | 24.1.0(a) explain causes | Scheme lesson(s) → lesson plan → learner content → assessment |
| 24.0.0 World Wars | 24.2.1 First World War | (b) Course | 24.1.0(b) describe course | Scheme lesson(s) → lesson plan → timeline/maps → assessment |
| 24.0.0 World Wars | 24.2.1 First World War | (c) Results | 24.1.0(c) discuss results | Scheme lesson(s) → lesson plan → consequence analysis → assessment |
| 24.0.0 World Wars | 24.2.2 League of Nations | (a) Formation | 24.1.0(d) explain formation | Scheme lesson(s) → lesson plan → content → assessment |
| 24.0.0 World Wars | 24.2.2 League of Nations | (b) Organisation | 24.1.0(e) describe organisation | Scheme lesson(s) → lesson plan → organisation visual → assessment |
| 24.0.0 World Wars | 24.2.2 League of Nations | (c) Performance | 24.1.0(f) discuss performance | Scheme lesson(s) → lesson plan → case analysis → assessment |
| 24.0.0 World Wars | 24.2.3 Second World War | (a) Causes | 24.1.0(a) explain causes | Scheme lesson(s) → lesson plan → learner content → assessment |
| 24.0.0 World Wars | 24.2.3 Second World War | (b) Course | 24.1.0(b) describe course | Scheme lesson(s) → lesson plan → timeline/maps → assessment |
| 24.0.0 World Wars | 24.2.3 Second World War | (c) Results | 24.1.0(c) discuss results | Scheme lesson(s) → lesson plan → consequence analysis → assessment |

The shared objective codes for WWI/WWII are intentional: the syllabus objective combines the two wars while the content section separates them.

## Scheme of Work contract
A scheme row is a scheduling/allocation of curriculum, not a new curriculum record. It should reference the canonical curriculum IDs and add teacher planning fields:

- term
- week
- lesson/period number
- topic and subtopic display labels
- objective(s)
- teacher/learner activities
- resources/references
- assessment/check-for-understanding
- remarks/progress
- planned duration

A curriculum leaf may require more than one scheme period. Splitting it across periods must not duplicate or mutate the curriculum authority record.

Example:

`Term 1 → Week N → Period 1 → World Wars → First World War → Causes → 24.1.0(a)`

A second period can continue the same leaf with a different teaching focus while retaining the same canonical objective/outcome binding.

## Lesson Plan contract
`Create Lesson Plan` from a scheme row must inherit curriculum identity rather than asking the teacher to reselect it.

The plan may derive from certified History content:

- prerequisite knowledge
- lesson objective(s)
- opening hook
- vocabulary
- explanation sequence
- chronology / causation prompts
- teacher activities
- learner activities
- resources / visual briefs
- misconception checks
- formative questions
- KCSE exam connection
- closure / summary
- homework / extension
- differentiation
- reflection / next lesson

A teacher can edit pedagogy and delivery, but editing a lesson plan must not rewrite the curriculum authority text.

## Teaching Session contract
Starting a lesson should preserve:

`scheme_row_id → lesson_plan_id → curriculum_node_id/outcome_id → content_artifact_version`

Evidence captured during teaching (attendance where relevant, checks, learner responses, homework, reflection) remains traceable to the same curriculum objective.

## Assessment contract
Questions attached to a scheme/lesson must carry:

- curriculum objective/outcome ID
- content leaf
- question type
- command word
- marks
- marking guidance
- difficulty/cognitive demand
- provenance (`VibeSchool practice`, never falsely `KNEC past paper`)
- question-bank version

This permits objective-level mastery and prevents questions from drifting away from what was taught.

## Progress contract
Completion is recorded against canonical curriculum identity, not against a display chapter number. Teacher OS can therefore answer:

- what has been scheduled;
- what has been taught;
- which objectives have evidence;
- what remains;
- where revision is needed.

## Learner display mapping
For usability only:

- Topic: World Wars
- Chapter 1: First World War
  - Lesson: Causes
  - Lesson: Course
  - Lesson: Results
- Chapter 2: League of Nations
  - Lesson: Formation
  - Lesson: Organisation
  - Lesson: Performance
- Chapter 3: Second World War
  - Lesson: Causes
  - Lesson: Course
  - Lesson: Results

`Topic`, `Chapter`, and `Lesson` here are learner-facing labels. Official curriculum codes remain the authority underneath.

## Guardrails
1. Never generate a scheme row without a resolvable curriculum node/outcome for governed content.
2. Never treat a learner display chapter as an official syllabus topic.
3. Never allow lesson-plan edits to mutate curriculum authority.
4. Never mark an objective taught solely because content exists; require teaching/progress evidence.
5. Never attach uncertified content as authoritative learner material.
6. Never label VibeSchool-generated questions as official KNEC questions.
7. Preserve version IDs so later content repairs do not rewrite historical teaching evidence.

## Readiness gate
History is Teacher-OS-ready only when:

- curriculum hierarchy is verified and bound;
- all nine World Wars leaves resolve to the correct objective(s);
- scheme generation preserves those IDs;
- lesson-plan generation inherits them;
- certified content can be attached by version;
- assessment items preserve objective linkage;
- progress/evidence can be traced back to the objective;
- no Grade 10 History & Citizenship identifiers can cross-bind into this Form 4 subject.

Until these are proven in integration, this document is a contract, not a claim of runtime completion.
