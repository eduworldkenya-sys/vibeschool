# VibeSchool History Derivation & Product Contract v1

Status: candidate; unmerged; runtime proof pending.
Scope: Form 4 History & Government. This contract makes one certified curriculum/content artifact reusable across Teacher OS and Student OS without maintaining contradictory copies.

## Canonical rule
A certified History knowledge artifact is the source for derived experiences. Teacher notes, lesson plans, learner notes, homework and exams are views/derivatives with provenance and version bindings. They must not silently become new curriculum authority.

## Teacher OS products

### 1. Scheme of Work
Inputs: curriculum hierarchy, term calendar, teacher allocation, lesson duration, school timetable.
Output fields: term/week/period; topic/subtopic; objective; activities; resources; assessment; remarks; curriculum IDs; artifact version.
Rules: a curriculum leaf can span several periods; scheduling never mutates the curriculum.

### 2. Lesson Plan
Must support generation from a scheme row or direct curriculum selection.
Required sections:
- curriculum identity and objective(s)
- prerequisite knowledge
- measurable lesson outcomes
- resources
- introduction/hook
- lesson development in timed teaching phases
- teacher activity
- learner activity
- historical thinking focus (chronology/causation/evidence/significance as relevant)
- vocabulary
- misconceptions and diagnostic prompts
- formative checks with expected responses
- differentiation/support and extension
- KCSE connection
- closure
- homework/next step
- teacher reflection and next-lesson decision

### 3. Teacher Notes
A teacher-facing deep view, not a copy of learner notes. Include:
- authoritative explanation and chronology
- teaching emphasis and likely misconceptions
- key dates/people/places
- causal links and contested/nuanced claims where relevant
- board/summary notes
- examples and analogies that are historically safe
- suggested questions and expected responses
- source/visual suggestions
- exam emphasis
- references/provenance

### 4. Classroom Assessment
Teacher can derive:
- entry diagnostic
- oral questioning
- exit ticket
- short quiz
- structured class exercise
- source/map/timeline interpretation where suitable
- mastery check
Each item binds to objective, command word, marks, difficulty and marking guidance.

### 5. Homework
Homework is a first-class derivative, not an afterthought. Support:
- recall/retrieval homework
- explanation practice
- chronology/timeline task
- comparison/cause-effect task
- source interpretation
- KCSE-style structured practice
- remedial homework based on learner evidence
- extension challenge
Every task includes expected completion time, objective, instructions, marks where applicable, marking guidance and feedback notes.

### 6. Tests and Exams
Support assembling objective-balanced papers from certified question banks:
- topic test
- end-of-unit test
- revision test
- mock/practice paper sections
- teacher-selected/custom paper
Paper metadata must include scope, marks, suggested time, objective coverage and difficulty balance.
Every paper produces a separate marking scheme and coverage blueprint.
Generated questions are labelled VibeSchool practice unless genuine KNEC provenance is independently verified.

### 7. Marking and feedback
Teacher view should expose:
- acceptable points
- explanation depth expected
- mark allocation
- common wrong answers
- diagnostic meaning of errors
- remediation recommendation
- model response where pedagogically useful
Do not reduce History marking to keyword matching.

### 8. Teaching Session / Evidence
During/after teaching, capture links to curriculum, scheme row, lesson plan, artifact version, questions used, homework assigned, evidence/assessment results, teacher reflection and next action.

## Student OS products

### 1. Learn
Mobile-first teaching experience:
- opening historical problem/hook
- what learner will understand
- prior-knowledge bridge
- vocabulary in context
- chunked explanation
- chronology/timeline
- maps/visuals when instructional
- cause/consequence connections
- key people/places
- misconception corrections
- embedded checks
- Think Like a Historian prompts
- exam connection
- concise close

### 2. Notes
Two modes from the same artifact:
- `Study notes`: complete, explanatory notes.
- `Quick notes`: compact revision-ready points without destroying causal meaning.
Learners can revisit by topic/chapter/lesson and objective.

### 3. Revision
Must provide:
- key facts and dates
- cause/result/comparison structures
- timeline reconstruction
- glossary
- misconception flash checks
- retrieval questions
- weak-area targeting based on evidence
- spaced re-check opportunities where product supports it

### 4. Practice
Progression:
`Recall → Understand → Explain → Connect → Apply to source/timeline/map → KCSE-style practice`.
Provide feedback explaining why an answer earns/loses marks rather than only right/wrong.

### 5. Homework / assignments
Learner sees clear task, objective, due context when assigned, estimated effort, submission requirements and feedback. Student self-practice uses the same item contracts but is labelled practice rather than teacher-assigned homework.

### 6. Exam preparation
Learner can access:
- topic questions
- timed practice
- command-word coaching
- model answers
- weak vs strong response comparison
- marking-scheme interpretation
- objective coverage/mastery gaps
- cumulative World Wars practice
No false KNEC provenance.

### 7. Progress
Student progress is objective-based and evidence-backed. Distinguish:
- viewed
- practised
- assessed
- demonstrated
- needs revision
- mastered
Content completion alone is not mastery.

## Parent/reporting derivative (future-compatible)
Do not expose raw curriculum internals. Reports may summarize what was taught, current mastery, missed work, strengths, gaps and recommended next action, derived from objective evidence.

## Artifact components required to support both OSs
Every gold-standard unit must contain or explicitly mark N/A:
1. curriculum binding
2. learner outcomes
3. prerequisites
4. hook
5. vocabulary
6. full explanation
7. chronology
8. causation/consequence reasoning
9. people/places
10. visual/source briefs
11. misconceptions
12. embedded formative checks + answers
13. historical-thinking prompt
14. teacher emphasis notes
15. board/summary notes
16. learner study notes
17. quick revision notes
18. homework set(s) + marking guidance
19. assessment bank across cognitive levels
20. KCSE-style practice + marks
21. marking scheme
22. model/strong response where useful
23. weak-response diagnosis
24. remediation/extension paths
25. glossary
26. factual claim/source ledger
27. version/provenance metadata
28. QA ledger

## Derivation safety
- A derivative stores `source_artifact_id` + `source_artifact_version`.
- If source content is repaired, previously delivered teaching evidence retains the version actually used.
- A new version may trigger review/regeneration, never silent historical rewriting.
- Teacher edits create teacher-owned overrides/drafts; they do not mutate the certified source.
- Student content exposes only certified versions.
- Assessments cannot claim coverage of objectives absent from their item bindings.

## Product acceptance matrix
| Capability | Teacher | Student | Required proof |
|---|---|---|---|
| Curriculum navigation | yes | yes | correct Form 4 IDs |
| Scheme of Work | create/edit/use | view only if product chooses | objective preserved |
| Lesson plan | create/edit/use | no | inherited binding |
| Teacher notes | full | no | content provenance |
| Study notes | optional preview | full | certified artifact |
| Revision | assign/recommend | full | same objective/artifact |
| Assessment | create/assign/mark | attempt/review | item-objective binding |
| Homework | create/assign/mark | attempt/submit/review | binding + feedback |
| Exam practice | assemble/review | practise | blueprint + marking scheme |
| Progress | class/learner view | own view | evidence-backed states |
| Reflection | teacher | learner reflection optional | linked teaching session |

## Gold-standard certification requirement
WWI Causes cannot be called gold-standard until it demonstrates all applicable components above, passes curriculum/fact/pedagogy/exam/editor/critic gates, and its derivatives can be produced without losing curriculum identity or introducing contradictory facts.
