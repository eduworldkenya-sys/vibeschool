# Form 4 History & Government — Full Production Loop v1

Status: execution contract; PR #572 remains unmerged.
Goal: produce the remaining Form 4 History corpus once, at the World Wars gold-standard depth, without repeatedly redesigning skills or artifact contracts.

## Operating rule
World Wars is the calibration/certification topic. In parallel, every remaining Form 4 topic may be drafted through this loop, but nothing is certified/published until its authority and QA gates pass.

The loop is artifact-first and deterministic where possible. Skills run against the same canonical curriculum IDs and artifact version. No skill is allowed to silently rewrite curriculum authority.

## Skill roster — locked for production

### 1. Curriculum Intake / Guardian
Input: canonical KICD/KIE authority artifact.
Responsibilities: preserve subject/form/topic/content/objective codes; exact source locators; scope boundaries; 8-4-4 History & Government isolation from Grade 10 History & Citizenship; detect missing/extra curriculum leaves.
Output: verified curriculum map + leaf/objective bindings.
Blocking: yes.

### 2. History Researcher / Fact Builder
Responsibilities: construct claim ledger before/deep alongside prose; dates, people, places, institutions, treaties, chronology, African/Kenyan relevance; distinguish fact from interpretation; attach authoritative/reputable source locators; flag uncertainty instead of inventing.
Output: evidence pack + claim/source ledger.
Blocking: yes for certification.

### 3. Senior History Teacher / Author
Persona: experienced Kenyan secondary History teacher who teaches for understanding and KCSE performance, not note dumping.
Responsibilities: rich explanation; background; chronology; cause/mechanism/consequence/significance; connections across topics; vocabulary; examples; misconceptions; historical thinking; classroom-ready sequencing.
Output: canonical deep teaching artifact.

### 4. Pedagogy Designer
Responsibilities: prerequisites; hook; learner outcomes; chunking; questioning; teacher/learner activities; expected responses; formative checks; differentiation; remediation; extension; closure; memory/retrieval design.
Output: teaching layer embedded in artifact.

### 5. Kenyan Context Editor
Responsibilities: add Kenya/East Africa/Africa relevance only when curriculum-relevant and source-supported; prevent invented local colour; explain colonial/global connections sensitively and accurately.
Output: contextual layer + source requirements.

### 6. KCSE Examiner / Assessment Architect
Responsibilities: command words; mark-demand alignment; cognitive progression; objective coverage; class questions; homework; topic tests; cumulative tests; model/strong responses; weak-response diagnosis; marking guidance; alternative defensible answers; no false KNEC provenance.
Output: versioned assessment bank + blueprints + marking schemes.

### 7. Teacher Product Deriver
From the canonical artifact derive: Scheme-of-Work rows, full lesson plans, teacher deep notes, board notes, resources, classroom activities, expected learner responses, formative assessment, homework, tests/exams, marking schemes, reflection prompts and next-lesson recommendations.
Rule: retain source_artifact_id/version and curriculum IDs.

### 8. Student Product Deriver
Derive: Learn experience, study notes, quick notes, glossary, timelines/maps/visual briefs, embedded checks, revision, retrieval practice, homework/assignments, KCSE practice, model-answer coaching, remediation/extension and objective-based mastery evidence.
Rule: Student OS only exposes certified source versions in production.

### 9. Visual Learning Designer
Responsibilities: identify visuals that genuinely teach—maps, timelines, cause webs, organisation diagrams, comparison tables, sequence cards; write date/geography-specific briefs and text alternatives; no decorative-image requirement.
Output: visual manifest ready for generation/implementation.

### 10. Learner Editor
Persona: edits for an ordinary Form 4 learner reading primarily on a phone.
Responsibilities: clarity without dumbing down; define technical terms; remove unexplained jumps; improve headings/chunks; maintain causal meaning; eliminate robotic/repetitive prose.
Blocking: yes.

### 11. Fact Checker
Independently verify material claims against evidence pack; test chronology, names, geography, institutional functions, numbers/quotes, causal overstatement and contested interpretations.
Blocking: yes.

### 12. Independent Critic
Adversarial review. Ask: what is missing, shallow, contradictory, misleading, unteachable, unassessed, unsupported, or likely to force teacher/student to seek another basic source?
Cannot self-certify author work.
Blocking: yes.

### 13. Repair Editor
Consumes all failed gate findings once, repairs canonical artifact and derivatives, records disposition for every blocking finding, then sends exact repaired version to re-QA.

### 14. Release Certifier
Checks exact-version authority, all blocking gates, derivative/version lineage, assessment coverage, runtime rendering/evidence proof and publication safety. Certification and publication are separate states.

## Canonical content package per curriculum leaf
Every leaf must contain, or explicitly justify N/A:
1. curriculum IDs + exact objective text/binding
2. title + learner outcomes
3. prerequisite bridge
4. compelling historical question/hook
5. vocabulary in context
6. detailed background/context
7. complete explanation/narrative
8. chronology/timeline
9. key people/places/institutions
10. cause/mechanism/consequence/significance reasoning
11. cross-topic connections
12. Kenya/Africa relevance where appropriate and sourced
13. misconceptions + corrections
14. historical-thinking/evidence prompt
15. formative checks distributed through content
16. expected responses/feedback
17. teacher emphasis + likely learner difficulty
18. board/summary notes
19. teacher/learner activities
20. resource/visual briefs
21. learner study notes
22. learner quick revision notes
23. glossary
24. retrieval/revision set
25. homework set(s) + marking guidance
26. assessment bank: recall → understand → explain/connect → source/map/timeline where applicable → KCSE-style
27. command-word coaching
28. marking scheme + alternative valid responses
29. model/strong response where useful
30. weak-answer diagnosis + remediation
31. extension path
32. factual claim/source ledger
33. artifact/version/provenance metadata
34. QA ledger

## Topic-level package
In addition to leaf packages, every topic receives:
- topic introduction and concept map
- ordered chapter/lesson navigation
- cumulative chronology where relevant
- topic glossary
- cumulative revision pack
- objective coverage matrix
- balanced topic test
- marking scheme
- exam-practice set
- teacher scheme allocation candidate
- mastery/remediation map

## One-pass production state machine
`AUTHORITY_MAPPED → RESEARCH_PACKED → DEEP_DRAFTED → PEDAGOGY_ENRICHED → ASSESSMENT_BUILT → TEACHER_DERIVED → STUDENT_DERIVED → VISUAL_BRIEFED → FACT_QA → CURRICULUM_QA → PEDAGOGY_QA → EXAM_QA → LEARNER_QA → CRITIC_QA → REPAIR → RE_QA → CERTIFIED → RELEASE_ELIGIBLE`

Any blocking gate failure routes to one consolidated REPAIR pass. Do not bounce the artifact between workers for one issue at a time.

## Batch execution strategy
To avoid wasted time:
- Map the entire remaining Form 4 curriculum first.
- Create all topic/leaf IDs and empty artifact manifests in one batch.
- Research independent topics in parallel.
- Deep-draft leaves in parallel only after their curriculum identity is fixed.
- Generate teacher/student derivatives from canonical artifacts, never independently authored copies.
- Build assessment banks alongside content, not at the end.
- Run cheap deterministic completeness checks across the whole batch before expensive critic passes.
- Aggregate QA findings per topic; perform one repair batch; re-QA exact repaired versions.
- Never wait for runtime certification of one topic merely to draft another.
- Never publish an uncertified topic merely because batch production finished.

## Deterministic completeness checks before human/critic QA
Fail a leaf automatically if: missing objective binding; missing explanation/chronology when applicable; no formative checks; no teacher layer; no student notes; no homework; no assessment items; no marking guidance; no source ledger; missing version metadata; generated exam item claims KNEC provenance without verified source.

Fail a topic automatically if: any curriculum leaf missing; any objective uncovered; no cumulative assessment; assessment blueprint has uncovered objective; no revision pack; derivatives point to different canonical versions.

## Assessment minimums
Per leaf candidate minimum: 5 retrieval/knowledge checks, 3 understanding/explanation items, 2 higher-order connection/application items where appropriate, 2 KCSE-style structured prompts, homework options, marking guidance and at least one weak-answer diagnostic.

Per topic: enough non-duplicative items to assemble at least two balanced practice variants without immediately repeating the same core questions. Exact count can grow by topic breadth; quality/coverage outrank raw quantity.

## Writing standard
Never produce bare revision bullets as primary teaching content. For important concepts use:
`What/background → what happened/how it worked → who/where/when → why → consequence → significance → connection → misconception → learner check → exam application.`

Use narrative where sequence matters, causal models where explanation matters, comparison where distinction matters, and tables only when they improve cognition. Avoid generic filler and invented anecdotes.

## Runtime contract
Teacher path to prove:
`Curriculum → Scheme row → Lesson Plan → Teacher notes/resources → Teaching Session → Assessment/Homework → Marking/Evidence → Reflection/Progress`.

Student path to prove:
`Curriculum/Chapter → Learn → Notes → Checks/Practice → Homework/Assessment → Feedback → Revision/Remediation → Evidence/Mastery`.

Both paths retain curriculum IDs + canonical artifact/version. Historical teaching evidence retains the version actually used.

## Parallel execution while World Wars is finished
Track A — World Wars certification:
authority seal/binding → runtime proof → final QA/repair → certification candidate.

Track B — whole Form 4 production:
full curriculum manifest → research packs → rich drafts → assessments → teacher/student derivatives → batch QA/repair. All remain DRAFT/UNPUBLISHED until gates pass.

## Stop conditions / owner actions
Do not interrupt production for routine drafting/QA repairs. Stop only for: missing/unobtainable canonical curriculum authority; genuinely disputed scope requiring owner choice; publication approval; destructive migration/runtime activation; or a policy/business decision not resolvable from the production contract.

## Definition of done — Form 4
Not `files exist`. Done means every curriculum leaf is represented; every objective covered; rich learner teaching content exists; teacher derivatives exist; student derivatives exist; assessment/homework/exam coverage exists; material claims are sourced; all blocking QA gates pass exact versions; runtime lineage works; topic-level revision/tests exist; and only then each topic becomes certification/release eligible.

## Merge rule
PR #572 remains unmerged until the World Wars calibration proof is complete. Whole-Form-4 drafts may accumulate on the branch or subsequent isolated production branches, but certification/release status must never be inferred from presence in Git.