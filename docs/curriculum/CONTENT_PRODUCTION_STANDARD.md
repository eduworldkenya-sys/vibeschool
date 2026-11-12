# VibeSchool Curriculum Content Production Standard — Grades 1–9

**Policy version:** 1.1
**Learning-first and assessment-lineage revision:** 12 November 2026  
**Decision:** Approved by the VibeSchool owner, 11 November 2026  
**Scope:** All new and materially revised VibeSchool-original competency-based content for Grades 1–9, across subjects, terms and learner/teacher surfaces  
**Status:** Repository policy; **not** itself a production deployment, worker commissioning or publishing authorization
**Current production method (11 November 2026):** **ChatGPT-led manual content production**; follow [Content Production Operating Model](./CONTENT_OPERATING_MODEL.md). New Cyborg content-authoring automation is deferred; current engineering governance and release controls remain unchanged.

## 1. Purpose and operating principle

VibeSchool produces **usable education**, not just a curriculum outline, a list of lesson titles, a PDF, or a set of exam questions. Each required curriculum outcome must be made **teachable, learnable, practicable and assessable**, with appropriate support for both an independent learner and a teacher.

**One outcome, many reusable learning experiences, one canonical source.** Do not implement a separate content store or question engine for every tool, grade, user role or school.

This is the standard for all Grades 1–9. The contents of a particular lesson are determined by its learning outcome and subject. **Not every lesson requires every media type or activity type.** A missing applicable component is a quality defect; omitting an inapplicable component with a short reason is acceptable.

## 2. Authority, alignment and originality

1. Establish the exact **grade, subject, curriculum system, design title, revision/date, strand, sub-strand, outcome and source reference** before authoring. Use a verifiable current KICD design or other applicable official authority, not a remembered syllabus or unsourced third-party summary.
2. Capture the authoritative source URL or document identifier, revision, access date, section/page reference when available, and any uncertainty. Avoid claiming a source check or outcome verification that was not performed.
3. Preserve the **intent, scope, progression, competencies, assessment expectations and relevant lesson allocations** of the source design. Do not silently change outcomes to make content production easier.
4. Write **original VibeSchool explanations, examples, narratives, practical instructions, tasks, questions, feedback and teacher guidance**. A source-reference map and limited necessary titles are not permission to reproduce a copyrighted curriculum wholesale.
5. Separate **official curriculum facts** from **VibeSchool pedagogical choices** such as teaching sequence, learner examples, proposed exercises and resources.
6. Preserve uncertainty honestly. An author-generated draft is not an independently verified or released artifact. Do not fabricate KICD endorsement, human sign-off, source verification or learner-tested effectiveness.
7. Curriculum coverage is **subject-wide**, with a traceable status for every required outcome and its relevant progression. One completed sub-strand must never be reported as a completed subject.
8. **Mandatory pre-generation comparison:** every ChatGPT content-production task must inspect **both** the applicable current KICD curriculum design and the existing canonical VibeSchool curriculum (including persisted outcomes when available), compare the exact requested scope outcome by outcome, and record page/section-to-stable-ID evidence. Structural/title similarity or prior claims do not count as confirmation.
9. **Repair-before-content gate:** when VibeSchool misses or distorts a KICD requirement, correct and recheck the canonical curriculum and its Scheme/outcome references **first**. Do not begin learner notes, examples, exercises, question banks or teacher guides until all requirements in the declared content scope match in educational intent, scope, progression and assessment expectations. Preserve VibeSchool-original writing; do not copy the official publisher text wholesale. Record unmatched or unavailable evidence as `BLOCKED_CURRICULUM_RECONCILIATION`, not as verified or content-complete. See the mandatory [Operating Model Step 2A](./CONTENT_OPERATING_MODEL.md#step-2a--mandatory-kicd--vibeschool-curriculum-reconciliation-gate-before-authoring).

## 3. Distinct learning components

| Component | Main function | Typical evidence or output |
| --- | --- | --- |
| Lesson content / learner notes | Explain the concept in understandable language | Readable lesson with vocabulary and connections |
| Worked examples | Teach the method or reasoning | Ordered calculations/actions, plain-language reason for **each** meaningful step, formula/symbol meanings where applicable, correct answer and valid check |
| Images / diagrams / media | Make a concept visible or audible where useful | Captioned/accessible asset with source or rights trace |
| Demonstrations | Show how a method or performance is done | Ordered model actions and observable criteria |
| Activities | Learn by doing, exploring, talking or making | Instructions, materials, participation and evidence |
| Investigations / experiments | Test an idea or observe a result | Question, procedure, observations, interpretation, safety |
| Discussions / inquiry | Reason, communicate and reflect | Prompt, expected engagement, facilitation guidance |
| Projects | Apply outcomes to an extended authentic task | Brief, milestones, deliverable and rubric |
| Exercises | Practise a known skill, often repeatedly | Ordered tasks with solutions/feedback |
| Questions | Reusable prompts that elicit an answer | Item, outcome, answer/marking, rationale |
| Worksheets | Printable/offline grouping of practice | Tasks with clear directions and answer guide |
| Assignments / homework | Continue or demonstrate learning independently | Instructions, submission/evidence, feedback rule |
| Quizzes | Short formative understanding check | Outcome-linked items and immediate feedback |
| Tests / exams | Assess defined scope under an assessment policy | Blueprint, marking rules, review and results |
| Revision | Revisit and consolidate earlier learning | Key concepts, retrieval, mixed practice |
| Reflection | Help learners notice learning and next steps | Self-check and actionable response |
| Remedial support | Address identified gaps | Alternative explanation, scaffold and retry |
| Enrichment | Extend mastery without skipping required concepts | Appropriate higher-order challenge |
| Teacher guide | Make the content deliverable in a classroom | Pacing, preparation, prompts, misconceptions, inclusion |
| Assessment rubric / observation | Assess performance beyond a single right answer | Criteria, indicators and evidence capture |

These are **content functions**, not a directive to create twenty independent menus or database tables. An activity may contain questions; an exercise is a collection of practice tasks; a quiz may reuse eligible question-bank items. The learner-facing experience should remain simple.

## 4. Outcome-to-learning evidence contract

For **every required outcome**, map the following evidence. Select methods suited to the subject rather than filling templates mechanically:

1. **Understand:** a concept explanation with age-appropriate language, prerequisites and key vocabulary.
2. **See:** a worked/concrete example or demonstration where meaningful.
3. **Experience:** a learner action, observation, inquiry, conversation, performance or practical activity appropriate to the outcome.
4. **Practise:** guided practice, then independent practice where applicable.
5. **Show understanding:** a question, oral response, product, performance, assessment item or observation tied to the outcome.
6. **Know how it went:** correct answers, sample responses, marking scheme/rubric and constructive feedback.
7. **Recover or extend:** misconception support, accessible alternative, remedial practice or enrichment where needed.
8. **Teach it:** teacher prompts, instructions, expected evidence, differentiation and an appropriate time/resource estimate.

A non-applicable element must have a brief **reason** tied to that outcome (for example, a performance rubric can replace a written calculation exercise). A generic “N/A” or copied boilerplate does not count as justification.

Do not add six arbitrary questions, a fixed word count, a compulsory video, or a project to **every** lesson simply to satisfy a quota. Apply any stricter **existing subject-specific or release contract** where it actually governs the content; do not weaken it here.


## 4A. Learning-first teaching standard: understanding and teacher effectiveness

**Non-negotiable product objective:** A learner should understand and demonstrate the required learning, and a teacher should have practical support to teach, diagnose and respond. Curriculum coverage, question counts, pages, feature usage, artificial lesson length and engagement metrics alone are not evidence of understanding.

1. **Development, not grade stereotypes.** Use the grade and official outcome as the curricular target. Adapt vocabulary, sentence complexity, pacing, representation, cognitive load, fine-motor demands, practical risks and response length to developmental needs. Do not assume children of the same age or grade have the same prior knowledge or ability. Grade 1–3 content will often favour concrete objects, play, talk and visual demonstrations; Grades 4–6 can progressively combine concrete experiences with pictorial and abstract reasoning; Grades 7–9 can deepen inquiry, argument, abstraction and real-world application. These are flexible starting points, not age ceilings.
2. **Prerequisite diagnosis and differentiated paths.** Identify essential prior understanding and design one or more short checks. Provide a **support path** (simpler language, smaller steps, concrete model, accessible alternative and supported retry), a **core path** (the grade outcome) and an **extension path** (deeper reasoning or transfer). All paths retain the true outcome; accommodation must not silently lower the assessed construct. Do not automatically label a learner as low ability from one answer.
3. **Evidence-informed, subject-specific pedagogy.** Choose the lesson sequence to suit the outcome, learner and resources; do not impose one branded rigid model. Where applicable, **connect prior knowledge → explain or explore → model and guide → independent application → check understanding → respond with feedback, reteaching or extension**. Explicit modelling and guided practice work well for new procedures; inquiry, discussion, making, experimentation or performance may lead for other outcomes. Clearly specify the transition from teacher support to learner independence.
4. **Make reasoning visible.** Explain *why*, not just *what*. In Mathematics preserve the existing worked-example contract: explain every meaningful step, relevant formula and symbols, substitution, units, result and checking. In literacy, sciences, arts and practical subjects show the appropriate reasoning, demonstration, model response, criteria or performance process instead of forcing a calculation template.
5. **Frequent, low-stakes formative checks.** Ask questions or observe performance during teaching, including one transfer/application check where suitable. Record what would count as evidence of understanding and what likely incorrect answers reveal. Give actionable feedback and a useful next step; do not equate exposure, copying an example or completion with mastery.
6. **Practical teacher enablement.** Supply usable preparation notes, required/low-cost materials, suggested timing, demonstration or board/diagram steps, learner prompts, expected responses, common misconceptions, possible interventions, accessible alternatives, extension options and marking/observation guidance. Teacher aids are outcome-selected, not mandatory separate menus.
7. **Independence and inclusion.** Make published learner material readable without hidden teacher explanation; offer age-appropriate linguistic, visual, tactile, oral, motor or offline/low-resource alternatives when relevant. Use dignified, locally meaningful Kenyan contexts without stereotypes. Check the safety of physical and experimental work.
8. **Professional publishing quality.** Write original, accurate, fluent explanations, examples, diagrams and questions with consistent language and clean instructional design. Do not superficially paraphrase a publisher's protected content or imply KICD endorsement. Relevant diagrams must be correct, accessible and rights-clear; omit decorative media that adds no learning value.
9. **Learning evidence, not promotional claims.** When the system supports it, examine outcomes through real learner answers, teacher observations, corrected misconceptions and appropriately matched pre/post checks. An increase in page views, time spent or attempted questions is not proof of learning. Publish claims of improved results or teacher time savings only after a documented, consent-based comparison or pilot, with method, scope and limitations.

**Authoring acceptance check per outcome:** Can a learner encounter an intelligible explanation or experience; see a sound model when useful; try meaningful practice; demonstrate the intended outcome; receive constructive feedback or performance criteria; obtain appropriate support/extension; and can a teacher deliver and adapt the experience with the provided guidance? Record an outcome-based reason for any inapplicable component. Do not force a fixed question quantity, videos, artificial reading level or identical lesson template across subjects.

## 4B. Canonical assessment lineage and secure reuse

**One outcome-linked content authority; interoperable assessment consumers; no new question engine.** The canonical published Content Engine supplies learner content and content blocks; existing assessment-question and assessment-item structures supply the assessment contexts. Preserve links and stable identity across these existing models; do not assert that a Markdown policy itself connects every live lesson block to the bank.

| Teaching/assessment material | Canonical treatment | Reuse rule |
| --- | --- | --- |
| Explanation, worked example and demonstration | Learning content, with its own stable source reference | Not an exam item by default; if assessing the same skill, author a separate independent item |
| Guided practice, hints and fully revealed solutions | Visible learning support | Keep formative; do not reuse verbatim for a protected exam |
| Independent exercise or lesson check | Outcome-linked content/question record with correct answer or rubric | Eligible for practice/quiz reuse once checked, with appropriate feedback mode |
| Topic Practice and low-stakes quizzes | Reuse eligible question identities under their existing attempt/feedback policy | May use exposed practice variants; give immediate feedback where that product policy permits |
| Formal or controlled exam | Approved, assessment-eligible item set under existing exam rules | Use protected, unseen/equivalent variants; no leaked answer authority or trivial verbatim repeats from taught examples |

For each question or scored performance, retain the **stable source/question ID**, version, grade, subject, strand/sub-strand, verified learning-outcome reference, item type, language/accessibility adaptation, cognitive demand, difficulty, answer or rubric, explained solution, distractor quality where relevant, likely misconception, appropriate feedback, usage eligibility, review state and provenance. A set of exercises references its constituent questions; it is not another competing bank. The same learning outcome may support multiple *distinct* question variants, whose identity and relationship are traceable.

**Assessment safeguards:** Learners must not receive formal-exam correct answers or marking secrets before permitted release. Prevent direct reuse of exposed worked examples and answers in secure assessments. Preserve distinct practice/exam scheduling, timers, attempt limits, marking, release and security policies. Avoid incorrect inflated mastery from repeated known items; use sufficiently fresh application/transfer evidence and teacher observation where appropriate. Do not silently turn unanswerable/reflection prompts into auto-marked items or invent missing answers. Preserve existing review, access control and publication requirements.

**Integration verification:** Inspect the actual Content Engine/assessment schemas before wiring identities. Test one real outcome across learner notes → worked example → independent exercise → Topic Practice → controlled assessment eligibility → feedback/progress, including wrong answer, skipped question, accessibility, teacher preview and protected-answer negative paths. Where a link is absent, mark it **NOT_CONNECTED**, repair the canonical integration separately and do not imply this policy revision deployed that feature.

## 5. Curriculum identity and planning separation

The authoritative chain is:

**Official KICD evidence → VibeSchool Curriculum Map (what and why) → Scheme of Work (when) → Lesson Plan + Teaching Content (how) → VibeLearn/learner reading (learn and practise) → Assessment (demonstrate) → Progress evidence.**

- **Curriculum Map:** grade/subject/strand/sub-strand/outcomes/competencies/values/PCIs and their evidence. Keep annual outcome authority separate from a school's weekly plan.
- **Scheme of Work:** term, week, ordered scheme lessons, outcomes and chosen pacing. A scheme **references** the curriculum; it does not replace or silently rewrite it.
- **Lesson Plan:** a teacher's lesson-specific flow derived from an eligible scheme item or explicit unscheduled curriculum selection. Teaching resources/notes/guides link to the exact lesson and outcomes.
- **Timetable:** is required for opening a dated scheduled occurrence and attendance; **not** for viewing the curriculum, preparing a scheme, preparing an unscheduled lesson, reading content or using independent study resources.
- **VibeLearn / content reader:** consumes published, learner-appropriate canonical content and permitted exercises without depending on a teacher, class membership or lesson timetable for independent learners.
- **Topic Practice / quizzes / formal exams:** reuse eligible outcome-linked questions through the existing assessment architecture; retain their different attempt, timing, feedback, release and marking rules.
- **Progress:** records the evidence actually earned by a particular learner; never invent a score, outcome mastery or verified completion from content availability.

Never force a dated timetable occurrence into a general content lookup, or attach a different week's/subject's scheme item because it is merely “next”.

## 6. Production workflow — from source to usable content

### Stage A — Identify and trace

- Record source authority, grade, subject, design revision, strand, sub-strand, all required learning outcomes, allocations and sequencing constraints.
- **Before content writing**, compare the official KICD design against the current VibeSchool canonical map and persisted outcome records one requirement at a time, recording KICD page/section, VibeSchool ID, mismatch status and source revision. Repair every `MISSING`, `PARTIAL`, `EXTRA` or `CONFLICT` affecting the requested scope through the existing controlled curriculum authority, then recheck Scheme/outcome links. If the comparison cannot pass, block content generation for that scope and report the evidence gap.
- Inspect existing VibeSchool canonical curriculum rows, content chapters, links, school-specific records and prior work; **extend**, do not overwrite unrelated teacher or school data.
- Create an outcome coverage matrix with stable references and statuses: unmapped, mapped, authored, checked, usable/released (only as evidenced).
- Resolve any material ambiguity by checking the source and existing contracts **without sending routine verification back to the owner**.

### Stage B — Plan a complete subject

- Build a subject-wide production map across all required strands/sub-strands; distinguish full-year scope from a term or pilot.
- Decide a realistic learning sequence and what must be explained, modelled, experienced, practised and assessed for each outcome.
- Identify practical equipment, language accessibility, offline use, likely misconceptions, core competencies, values, PCIs and relevant safety considerations.
- Select applicable learning component types; document exceptions, not a blanket all-components checklist.

### Stage C — Author learner-ready material

- Start with the learner's goal and prerequisite knowledge; explain concepts in clear, natural, age-appropriate language using accurate Kenyan contexts when useful.
- Provide meaningful examples with **every essential mathematical step and an explanation of why that step works**, not only the answer. When a formula is appropriate, introduce it, define the symbols and show substitution, units and checking. Avoid placeholder copy, repetitive filler, unsupported facts, and explanations that only restate outcomes.
- Give precise practical or discussion instructions, required resources, expected responses/evidence and a feasible alternative for resource-constrained settings.
- Make content understandable to an independent learner, not only a teacher who can supply missing explanation orally.
- Include clear headings, units, language conventions, alternative text/captions for essential visuals and reading-level/accessibility considerations.

### Stage D — Author practice and assessment

- Provide exercises or performance practice that follow the teaching, progress from guided to independent, and target named outcomes.
- Create original questions with stable item identity, type, difficulty/complexity, expected answer, explanation, marks/rubric, misconception and outcome mapping.
- Cover understanding, application and reasoning/performance appropriately; do not test untaught material.
- Supply teacher marking/observation guidance and learner feedback; support skipped, incorrect and retry cases where the consuming product supports them.
- Keep formative practice, homework, topic practice and formal exams as **distinct presentation and policy contexts** over reusable content, not separate duplicative question authorities.

### Stage E — Differentiate and review

- Add relevant low-resource and accessibility options, remedial explanations, extra practice, enrichment and reflection.
- Verify answers and examples independently of their original generation when possible; check mathematics step by step and subject facts against suitable evidence.
- Run the applicable Content Factory quality, source-fidelity, assessment, safety and independent-critique processes. Record actual evidence and substantive failures.
- Fix defects within scope, then recheck changed material. Never treat “AI reviewed it” as proof of independent verification by a person.

### Stage F — Bind into the canonical system

- Inspect current source-of-truth contracts before saving. Existing Content Engine lineage includes **vibe_publications → vibe_chapters (canonical blocks) → derived content_blocks/learning_resources → scheme_lesson_resource_links**, with separate assessment and progress consumers. Use actual current code/schema, not this document as a substitute for schema inspection.
- Reuse existing curriculum outcome IDs, chapter/resource identities, scheme bindings and assessment/question bank models when present; use stable identifiers and idempotent upsert/migration practices where appropriate.
- Preserve teacher-authored scheme, lesson plan, assessment, school and student records.
- Ensure teacher notes and Teacher Guide carry the selected curriculum/lesson context; avoid detached guides and duplicate copies.
- Do not publish content into a parallel route that bypasses the existing Content Engine or VibeLearn/reader policy.

### Stage G — Verify actual consumer journeys

Check the relevant real or controlled route, not only database presence:

- Teacher finds the curriculum without requiring a timetable, can select a scheme/unscheduled lesson, opens notes and guide with correct grade/subject/outcome context.
- Independent learner can open the eligible learner content and practise without a teacher's approval where the independent access policy allows.
- Questions/activities/exercises load, render, submit and provide correct feedback.
- Outcome-to-content-to-assessment links resolve without wrong-grade, wrong-sub-strand, wrong-week or stale versions.
- Empty, offline/slow-network where applicable, mobile, accessibility and permission-denied paths behave safely.
- Only claim **live** if the relevant publication, deployment, database state and learner-facing route were actually verified.

### Stage H — Release and learn

- Keep **drafted**, **source-checked**, **quality-reviewed**, **independently assessed**, **authorized for release**, **published** and **learner-visible** distinct.
- Apply the existing legitimate release authorization and safety controls; this standard alone does **not** commission automatic publishing, bypass human editorial/release authority where configured, or expand worker capabilities.
- Capture a versioned manifest, source/outcome trace, quality evidence, link verification and actual release state. After publication, use learner/teacher feedback and errors to repair the same canonical artifact and invalidate stale certification as needed.

## 7. No unnecessary owner-verification or administrative barriers

**Standing operating decision:** The owner has approved this **methodology**. Do not pause to ask the owner to verify each learning outcome, approve each lesson, supply a scheme, choose every example, approve ordinary edits, or personally perform routine source checks. Those are production-team/agent responsibilities.

Proceed autonomously, to the extent the **currently available capabilities and repository controls permit**, with:

- researching and mapping source requirements;
- producing VibeSchool-original drafts and classroom-ready materials;
- deterministic correctness checks, accessible alternatives and scoped content repair;
- completing outcome coverage, reference mapping, manifests and evidence;
- building reusable resources and preparing legitimate release candidates;
- retrying recoverable technical problems, checking canonical links and reporting exact status.

**Do not create:** teacher/class/timetable dependencies merely to prepare content; fake “verified” flags; hard-coded approval prompts for a syllabus already sourced; a new reviewer service when existing quality tooling suffices; duplicate engines; approval requests for each small content unit; or arbitrary lesson-volume / word-count limits.

**Real boundaries still apply:** If an authoritative source genuinely cannot be obtained, subject knowledge is uncertain in a consequential way, personal data is involved, rights are disputed, independent assurance is mandatory, or production release requires separately commissioned authority, record the **specific typed constraint** and complete all safe preparatory work. Do not silently bypass security, authorization, source integrity or existing publish gates. Escalate only a **genuine** decision that cannot be resolved with accessible evidence/tools; identify exactly who or what authorization is required, not a vague “owner verification” demand.

Being autonomous means **solving routine problems**, not relabelling drafts as verified, impersonating a human editor, or weakening the Content Factory release checks.

## 8. What the learner should see

Keep the learner interface simple even when the content model is rich:

1. **Learn** — explanation, worked examples and helpful media.
2. **Explore** — active, practical, inquiry or collaborative experiences.
3. **Practise** — graduated exercises and optional take-home tasks.
4. **Check** — formative questions, quiz/topic practice or appropriate performance evidence.
5. **Improve** — answers, feedback, correction, revision, remediation and enrichment.

Adapt the presentation to age, subject and device. Students should not need to understand internal terms such as “curriculum binding”, “source certification”, “canonical record” or “scheme occurrence”.

## 9. Subject-specific expectations

| Subject family | Stronger emphasis | Examples of valid alternative evidence |
| --- | --- | --- |
| Mathematics | clear concepts, **fully worked, explained steps**, formula meaning and symbol definitions **when applicable**, number sense, units, checking and graduated exercises | written/oral solution with method explanation and independently checked working |
| English / Kiswahili | listening, speaking, reading, writing, language in use | reading response, dialogue, composition, oral fluency rubric |
| Creative Arts / Sports | model/performance, making, movement, observation and feedback | finished artifact or observed skill performance |
| Science / Agriculture | investigation, practical reasoning, materials and safety | observation table, explanation, safely completed practical |
| Social / Religious / Environmental learning | source-grounded context, discussion, ethics, inquiry and application | explanation, project, civic/environmental task and rubric |

Apply the actual **KICD outcome**, not stereotypes about a subject. For practical work, specify materials, safety, procedure, observable result and an alternative if materials are unavailable.

### Mathematics worked examples — mandatory explanation of the method

For any Mathematics outcome that requires solving, calculating, constructing, measuring or applying a method, a **worked example must teach the process, not merely show a final answer**. Apply the same clarity to numeracy-heavy examples in other subjects when appropriate.

**Required worked-example sequence (adjust vocabulary to the learner's grade):**

1. **Question/problem:** State the task and what must be found. Identify the given numbers, quantities or geometric information.
2. **Choose the method:** Explain *why* an operation, model, strategy or formula is appropriate; connect it to the concept being taught.
3. **Introduce a formula when applicable:** Write it **before substitution**, explain in plain language what it means, define every symbol/variable and its units, and say when the formula is used. Never insert an unexplained formula or introduce algebra where the grade/outcome uses a concrete method instead.
4. **Show the working step by step:** Present each meaningful mathematical transformation or calculation **in order**. Next to or below each step, explain **what was done and why it works** (for example, regrouping, equivalent fractions, place value, inverse operations or unit conversion).
5. **Substitute carefully:** If a formula applies, show the known values being substituted, keep notation consistent, and work through intermediate calculations without unexplained jumps. Respect units and order of operations.
6. **State and interpret the answer:** Give the result, correct units where relevant, and a short sentence relating it to the original question.
7. **Check:** Validate the result using a sensible inverse operation, estimation, substitution, diagram, unit check or alternative method. The check must be **mathematically valid**, not a repeated assertion of the answer.
8. **Transfer:** Follow the model with a closely related guided question, then an independent exercise; give correct worked solutions or answer explanations in the appropriate learner/teacher view.

**Quality rules:**
- Do not accept examples that say only `28 + 17 = 45`, `P = 26 cm`, “use the formula”, or “simplify” with no reasoning when the outcome requires the method to be taught.
- Write explanations at the relevant grade's reading level. Show manipulatives, number lines, place-value tables, drawings and verbal explanations for early grades instead of forcing letter-based formulas.
- Break a long method into clear, meaningful steps but avoid padding a trivial operation with artificial steps. Do not skip the key reasoning point or hide it behind “obviously”.
- Distinguish **examples** (fully explained), **guided practice** (partial support) and **independent exercises** (learner solves). In learner self-study, feedback should provide a worked explanation after an attempt where appropriate.
- Independently recheck **every formula choice, variable definition, substitution, intermediate result, final answer and units**; correct mismatches in the canonical worked solution and all derived answer keys.

**Illustrative worked example A — addition with regrouping (teaching example, not a verbatim KICD outcome):**

**Question:** Add 28 and 17.

| Step | Working | Explanation |
| --- | --- | --- |
| 1 | `28 = 20 + 8`; `17 = 10 + 7` | Split into tens and ones so we can combine matching place values. |
| 2 | `8 + 7 = 15` | Add the ones. Fifteen ones are one ten and five ones. |
| 3 | `20 + 10 + 10 = 40` | Add the original tens and the extra ten made from the ones. |
| 4 | `40 + 5 = 45` | Put the tens and remaining five ones together. |

**Answer:** `28 + 17 = 45`. **Check:** `45 - 17 = 28`, so the addition is consistent. **No formula needed**: place-value reasoning is the suitable method.

**Illustrative worked example B — a formula only where the grade/outcome requires it:**

**Question:** Find the perimeter of a rectangle that is 8 cm long and 5 cm wide.

**Formula:** `P = 2(l + w)` means the perimeter is twice the sum of the length and width. Here `P` = perimeter in centimetres, `l` = length in centimetres, and `w` = width in centimetres. We use it because a rectangle has two equal lengths and two equal widths.

| Step | Working | Explanation |
| --- | --- | --- |
| 1 | `P = 2(l + w)` | Start with the perimeter formula for a rectangle. |
| 2 | `P = 2(8 + 5) cm` | Replace `l` and `w` with the given measurements; both are in centimetres. |
| 3 | `P = 2 × 13 cm` | Add the length and width inside the brackets first. |
| 4 | `P = 26 cm` | Multiply by 2 to account for both pairs of sides. |

**Answer:** The perimeter is **26 cm**. **Check:** `8 + 5 + 8 + 5 = 26 cm` by adding all four sides. This formula illustration does **not** assign perimeter to a particular grade; use it only if the selected official outcome includes it.

These are model explanations of **how to author content**, not claims that these sample tasks have been officially mapped or published.

## 10. Example — Grade 3 Mathematics: addition

**Outcome (illustrative VibeSchool formulation; not a quotation from KICD):** Learner adds two whole numbers correctly and explains the method.

- **Learn:** explain combining quantities and place-value reasoning.
- **Worked example:** Show how `12 + 8 = 20` by regrouping place values: `12 = 10 + 2`; `2 + 8 = 10` (the ones make another ten); therefore `10 + 10 = 20`. Explain **why** the tens and ones can be regrouped without changing the total; use counters or a number line if better suited to the learner. Check `20 - 8 = 12`. No formula is necessary.
- **Activity:** combine 12 and 8 bottle tops and explain the total.
- **Exercise:** several progressive addition tasks with answer checks.
- **Question:** “A learner has 12 pencils and receives 8. How many now?” Answer: 20; explain why.
- **Assessment:** different problem, oral/written response, correction feedback.
- **Remedial:** number line or grouped counters; **enrichment:** invent a word problem with the same total.
- **Teacher support:** prompts, misconception about carrying/regrouping, evidence to observe.
- **Binding:** all components reference the same actual mapped outcome; an independent learner reads and practises without a school timetable.

## 11. Quality matrix and failure dispositions

| Quality dimension | Required proof | Defect response |
| --- | --- | --- |
| Curriculum coverage | Each required source outcome maps to content and assessment evidence | Fill missing outcomes or narrow the scope claim |
| Subject correctness | Explanations, facts, methods and answer keys independently checked | Correct material and reverify affected items |
| Pedagogical depth | Understand → example → experience/practise → check → feedback, where applicable | Author the missing function; not filler |
| Ability-sensitive learning and teacher readiness | Prerequisites, scaffold/core/extension where useful; teacher can teach, assess and intervene using the guide | Revise explanations, pacing, materials, prompts or adaptation; validate with users when feasible |
| Assessment exposure and lineage | Stable item/outcome references; worked examples are not treated as secure exam items; protected answers and fresh variants respected | Repair eligibility/lineage, retire leaked items, recheck security and feedback |
| Authenticity and originality | VibeSchool-authored material with traceable external rights/source usage | Rewrite, license or remove unsupported material |
| Suitability and inclusion | Age, language, Kenyan feasibility, disability/resource access and dignity | Adapt task, wording, modality or resources |
| Safety | Materially relevant practical/physical/emotional risks mitigated | Stop unsafe activity; repair before use |
| Assessment integrity | Questions tied to taught outcomes; valid answers and rubrics | Correct, retire or remap invalid items |
| Canonical integrity | Same outcome/resource lineage across reader, teacher and assessment | Fix upstream link; do not create duplicate authority |
| Learner usability | Actual correct content rendered and usable with suitable feedback | Repair consumer path and retest |
| Publication honesty | Recorded state matches authorization, live route and evidence | Report draft/pending instead of claiming published |

Where a finding is material, record its evidence, owner/work lane, affected outcome(s), repair and recheck status. Do not lose a defect because a different component passed.

## 12. Definition of done and scope honesty

### A complete outcome

An outcome is **content-complete** when all applicable elements of Section 4 exist, the source/outcome binding is correct, the subject content/answers are checked, and the consuming artifact is readable. This is not the same as publication certification.

### A complete sub-strand

All required outcomes have content-complete evidence; relevant lesson sequencing, practice, assessment, teacher support and links exist. No missing outcome may be hidden by a high average quality score.

### A complete subject

Every required strand/sub-strand/outcome for the **declared grade/design/term scope** is covered, mapped, checked and packaged. Full-subject claims require full-subject evidence; “Term 1 complete” cannot become “subject complete”.

### Published and usable

Must have the actual authorized publication state, correct canonical reader link, relevant access policy and verified user journey. A merged Git PR, stored PDF or content draft does **not** prove learner visibility.

## 13. Minimum content package / evidence manifest

Every subject or sub-strand package should supply or link to:

- **Identity:** grade, subject, curriculum design revision, source, language, version, scope and status.
- **Coverage:** strand/sub-strand/outcome IDs, source references, competencies/values/PCIs where relevant, term/pacing constraints where authoritative.
- **Learning materials:** explanations, examples, relevant activities, exercises, questions, teacher guide, differentiations and correct responses/rubrics.
- **Links:** existing canonical chapter/resource IDs, outcome bindings, scheme references, question references and reader route (when actually assigned).
- **Evidence:** source retrieval/reference, content/answer checks, independent/quality evaluation as required, defect dispositions and author/reviewer separation.
- **Release facts:** draft/reviewed/authorized/published, version/SHA if applicable, learner/teacher journey results and access constraints.

Use the [ChatGPT-Led Content Operating Model](./CONTENT_OPERATING_MODEL.md) to execute this work today and the [Content Package Template](./CONTENT_PACKAGE_TEMPLATE.md) for each batch. The operating model defines the current team responsibilities and step-by-step workflow; this standard defines educational quality and canonical outcome requirements. Neither document creates a new runtime worker or requires routine owner sign-off.

## 14. Governance, implementation and review

This policy is a **content-production specification** subordinate to existing repository governance and live system authority. The **current authoring process** is [ChatGPT-Led Content Production](./CONTENT_OPERATING_MODEL.md); the Cyborg automation roadmap is deferred for curriculum authoring only, **not** removed from repository engineering or existing release governance. Read alongside:

- Repository root AGENTS.md and the Cyborg executor / canonical guardrails.
- docs/CONTENT_FACTORY_HANDOVER.md for canonical Content Factory remediation and release controls.
- docs/QUALITY_INTELLIGENCE_EVALUATION_PRIORITY2.md for independent quality evidence.
- docs/chemistry/LEARNING_QUALITY_CONTRACT.md for stronger subject-specific Chemistry obligations where applicable.
- supabase/CONTENT_ENGINE_MIGRATION_PARITY.md for existing content lineage.

This document **does not itself add a runtime validator, migration, new publishing rights or live content**. Implementation teams should encode applicable checks through existing Content Factory, quality/evaluation, mapping and delivery systems rather than building a competing pipeline. Future revisions require versioned, reviewed changes and must not silently weaken safety, authenticity or canonical authority.

**Operational default:** author completely, check independently as required, repair routinely, reuse canonical content, require no repeated owner sign-offs, and make only evidence-backed claims.
