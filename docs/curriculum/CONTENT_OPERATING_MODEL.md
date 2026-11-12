# VibeSchool Content Production Operating Model — ChatGPT-Led Phase

**Decision date:** 11 November 2026  
**Operating mode:** `CHATGPT_LED_MANUAL_CONTENT_PRODUCTION` (documentation/operating decision, **not** a new runtime flag)  
**Current scope:** KICD-aligned, VibeSchool-original learning content for Grades 1–9; adaptable to other grades with their own curriculum authority  
**Accountable direction:** VibeSchool owner sets the priorities; ChatGPT performs day-to-day research, authoring, revision, packaging and coordination within its actual available tools  
**Automation strategy:** Defer investment in **new Cyborg/Worker Engine content-authoring orchestration** until VibeSchool has sufficient content and operational demand to justify it.

> **Canonical decision:** Content first. ChatGPT is the primary **interactive production assistant** in this phase. It provides all of the working specialist *perspectives* needed to draft complete teaching and learning material. This is **not** a claim that ten independent qualified professionals have reviewed a draft, that a background workforce is running, or that production publishing controls are disabled.

## 1. Where this operating decision fits

The educational quality and curriculum requirements live in **[CONTENT_PRODUCTION_STANDARD.md](./CONTENT_PRODUCTION_STANDARD.md)**. Every subject follows that contract. The reusable outcome/subject manifest is **[CONTENT_PACKAGE_TEMPLATE.md](./CONTENT_PACKAGE_TEMPLATE.md)**. This document specifies **who does the work now, in what order, and what must be delivered**.

The existing **Content Engine** remains the canonical storage/publication and consumption architecture. The existing **Cyborg and repository engineering governance**, including `AGENTS.md`, remains in force for GitHub engineering, technical mutation, CI, migrations, deployment, release authority, and any existing governed automation. This decision **does not disable an existing worker**, reconfigure a scheduler, weaken quality gates, grant automatic publishing, or override live security/authorization. It means **do not require a new Cyborg worker/mission/orchestration build simply to write educational content**.

**Distinguish two activities:**

- **Educational authoring in chat:** Owner says “produce Grade 3 Mathematics”; ChatGPT sources, maps, authors, revises and prepares the complete subject content through normal interactive work, without requiring Cyborg execution to generate prose.
- **Changing the VibeSchool repository or live system:** Use the connected GitHub and platform tools only when available and authorized; follow the actual repository engineering process and existing content publication controls. A chat draft is **not** an automatic production write or live publication.

This is a **current operating choice**, not the deletion of the future automation architecture.

## 2. Working team — ten professional functions, one ChatGPT-led production desk

The roles below describe the **competence lens to apply**, not ten separate deployed AI agents, guaranteed degrees or human staff. When evidence requires a genuinely independent professional review, do not pass off another ChatGPT self-check as that review.

| Function | Professional expertise the function calls for | What ChatGPT prepares in the current phase |
| --- | --- | --- |
| 1. Content & Publishing Lead | Editorial planning, Kenyan education publishing, product priorities, production coordination | Subject backlog, batch plan, progress/coverage ledger, handoff and status report |
| 2. Curriculum Alignment Specialist | KICD/CBC/CBE curriculum mapping and quality assurance | Official-source mapping, complete strand/sub-strand/outcome inventory, source references and progression |
| 3. Subject Expert / Lead Author | Subject qualification plus relevant teaching and curriculum experience | Complete original learner explanations, accurate examples, applications and teacher-facing substance |
| 4. Instructional Designer | Age-appropriate pedagogy, learning progressions, inclusion and scaffolding | Prior knowledge, learning sequence, guided/independent practice, inquiry and differentiation |
| 5. Assessment Specialist | Competency-based/formative assessment, question construction, rubrics and marking | Outcome-linked questions, exercises, quizzes, answer keys, marking rubrics, feedback and misconceptions |
| 6. Illustrator & Media Planner | Educational illustration, demonstration design, visual accessibility | Detailed diagram/visual scripts, media briefs, labelled artwork and demonstrations where useful; create media only with suitable tools |
| 7. Educational Editor | Editing, language quality, educational clarity and Kenyan context | Clear English/Kiswahili wording, consistent terms, no filler, learner-friendly structure |
| 8. Inclusion & Safety Lens | Inclusive/SNE pedagogy, accessibility and age-appropriate physical/practical activity design | Low-resource alternatives, accessible instructions, safe practical activity guidance |
| 9. Quality Reviewer / Fact Checker Lens | Subject checking, gap detection, answers, outcome coverage, editorial critique | Structured self-audit, deliberate search for omissions and errors, targeted repair log |
| 10. Content Integration Specialist | Canonical Content Engine, data lineage, mapping, learner/teacher journeys and technical tests | Real content pack and integration instructions; direct GitHub/data changes when permitted and verified |

**Important qualification distinction:** ChatGPT can perform a structured authoring and self-review pass using these perspectives. It cannot claim to *hold* the listed professional qualifications or that independent reviewers, teachers or children tested the output unless those actual reviewers/tests are evidenced. Preserve existing independent quality and release gates where they apply.

### Efficient staffing principle

One interactive assistant can perform the **drafting functions in sequence** without building ten software agents. Reuse the same source map and content pack instead of regenerating it ten times. Apply subject-specific technical checks where necessary (for example, arithmetic, language conventions, scientific reasoning or safe movement). In the future, qualified editors/teachers can review completed batches when practical, without the owner personally acting as the reviewer.

## 3. Exact workflow for producing one grade/subject

**Production path:**

`OWNER SELECTS GRADE + SUBJECT → READ LIVE/CANONICAL VIBESCHOOL CURRICULUM + CURRENT KICD DESIGN → COMPARE AND RECONCILE EACH REQUIRED OUTCOME → RECHECK CORRECTED CURRICULUM AND SCHEME REFERENCES → COVERAGE LEDGER → SUBJECT BLUEPRINT → ORIGINAL CONTENT → ACTIVITIES + PRACTICE + ASSESSMENT → TEACHER/LEARNER DERIVATIVES → SELF-AUDIT + TARGETED REPAIR → CANONICAL CONTENT PACKAGE → EXISTING RELEASE PROCESS → REAL READER/JOURNEY CHECK`

### Step 1 — Owner picks the subject; no long setup

Accept a simple request such as **“Grade 4 English: produce the complete KICD-aligned VibeSchool version.”** Use the grade, subject and agreed Grades 1–9 standard. Do **not** ask again for approval, every strand, every question count or formatting preference already governed by this document.

If the request explicitly covers a term or one topic, respect that scope. Otherwise plan the **complete declared subject**, not a disguised single-lesson pilot.

### Step 2 — Find the correct curriculum and list its full scope

- Retrieve the relevant official KICD curriculum design and identify the revision, grade, subject, all strands/sub-strands, outcomes, competencies, learning experiences and assessment expectations, plus lesson allocations if given.
- Read the current VibeSchool canonical curriculum and complete **Step 2A's mandatory source-by-source comparison**; repair and recheck all mismatches *before* creating learner/teacher content.
- Construct an **outcome coverage ledger** for the whole declared scope **before** claiming completeness.
- Identify gaps or uncertainty from the source. Continue preparing what is verifiable; do not invent exact outcomes, allocation counts or source checks.

**Deliverable:** one source-referenced curriculum map and **completed KICD ↔ VibeSchool reconciliation ledger with a proven PASS for the exact scope**; a mere index or unfinished comparison is not authorization to write learning content.

### Step 2A — Mandatory KICD ↔ VibeSchool curriculum reconciliation gate (before authoring)

**Every content-generation chat MUST do this first, for the exact grade, subject and content scope requested.** Existing curriculum maps, previous chat claims, a matching topic title, a Scheme of Work and a content package are **not** evidence that the VibeSchool curriculum fully matches KICD.

1. **Read both real sources:** inspect the latest applicable **official KICD curriculum design** (URL, edition/revision, relevant page/section) and the **current VibeSchool canonical curriculum** (repository catalogue AND persisted curriculum/outcome records where available). Never invent an inaccessible source or infer coverage from a filename.
2. **Compare the requirements side by side:** grade, subject and design version; every strand and sub-strand; **each specific learning outcome's meaning and scope**; key inquiry questions, suggested experiences, competencies, values, pertinent contemporary issues and assessment expectations; progression, suggested lesson allocations and any applicable adaptations. A VibeSchool-original paraphrase may differ in wording, **but it must preserve all KICD requirements**. KICD source text must not be copied wholesale into VibeSchool materials.
3. **Record the evidence:** give every source requirement an authoritative page/section locator, its matching VibeSchool stable identity and one of `MATCH`, `MISSING`, `PARTIAL`, `EXTRA`, `CONFLICT` or `NOT_CHECKED`. Show source-version and suggested-lesson discrepancies explicitly; do not invent a KICD allocation just to reach a timetable total. Preserve a concise source-to-outcome reconciliation ledger.
4. **If anything does not match, fix the VibeSchool curriculum *before generating content*.** Correct missing, incomplete, wrong-grade or wrong-scope requirements in the existing canonical curriculum authority, not only in manuscript prose. Preserve stable IDs, existing content versions, teacher-owned schemes and historical evidence wherever possible. Use the existing authorized repository/database migration and test process for technical writes; don't silently overwrite live teacher records. Recheck the affected curriculum, Scheme references and outcome identity after every fix.
5. **Proceed to learner notes, examples, exercises, assessment and teacher guidance only when every KICD requirement within the declared scope is `MATCH` and the corrected VibeSchool map is confirmed.** If official source or canonical data cannot be accessed, or an unresolved conflict remains, mark that scope **`BLOCKED_CURRICULUM_RECONCILIATION`** and report the exact gap; do not invent an outcome, certify a match, skip ahead to content generation, or ask the owner to manually fix routine discrepancies. A separately reconciled sub-strand can proceed only when the deliverable is explicitly scoped to that sub-strand; never call it a completed subject.
6. **Keep two different statuses separate:** a source-reconciled curriculum map is not yet a complete, quality-checked, integrated or published lesson. Content still needs its own correctness, rights, accessibility, integration and release checks.

**Required handoff sentence before authoring:** `KICD ↔ VibeSchool curriculum reconciliation: [GRADE/SUBJECT/SCOPE]; [source edition and pages]; [N/N required outcomes MATCH]; [defects corrected or unresolved]; [canonical evidence reference]; PASS/BLOCKED.` Never write `PASS` without actually reading and comparing both sources.

### Step 3 — Build the subject teaching blueprint

For each sub-strand, plan a meaningful sequence of outcome-linked learning units. Choose what **needs** notes, worked examples, diagrams, practical activities, experiments, discussions, projects, exercises, questions, quizzes, performance tasks, remediation or revision. Do not pad an outcome to match a fixed number of tools.

**Deliverable:** sub-strand and lesson sequence with purpose, prerequisites, estimated instructional scope, assessment method and outcomes.

### Step 4 — Write the actual learner content

For each unit provide, when relevant:

1. **Learning goal** stated naturally for the learner.
2. **Clear explanation** with key vocabulary and background knowledge.
3. **Worked/concrete example** showing the method in **ordered, fully explained steps** where applicable. For Mathematics, show each meaningful operation, why it was done, any formula with its purpose and symbols (only if the outcome calls for one), substitution and units, answer and a valid check; see the [Mathematics worked-example contract](./CONTENT_PRODUCTION_STANDARD.md#mathematics-worked-examples--mandatory-explanation-of-the-method).
4. **Meaningful activity or inquiry** with instructions, materials and what to observe/do.
5. **Guided practice and independent exercise**, appropriate to age/skill.
6. **Questions and assessment** aligned to the taught outcome, with correct answers/explanations or rubrics.
7. **Feedback and common-error correction**, plus a brief remedial and enrichment path.
8. **Summary/revision** where appropriate.

**Visual aids are part of applicable lesson content:** decide whether a diagram, chart, map, picture, number line, labelled illustration, fraction model or demonstration image is needed. Record **type, purpose, exact content to show, labels, caption and alt description, intended audience and placement**. A visual brief is not the asset: create the real visual where needed and register it once in the [Visual Learning Library](./VISUAL_LEARNING_LIBRARY.md), using its canonical ID rather than hardcoded image URLs. Draft assets do not become learner-visible by saving them.

For Creative Arts or physical outcomes, a demonstration, practical performance and observation rubric may take precedence over a long written exercise. **For Mathematics, showing only the final calculation or formula is insufficient:** explain *why* each essential step works, define formula variables and demonstrate substitution when applicable, check answers and units, then follow with guided and independent practice. Do not force formulas or unnecessary algebra on early grades.

**Deliverable:** real readable content, not empty headings, a curriculum listing, one paragraph of notes or a promise of future generation.


### Mandatory learning-first authoring and reuse decision (12 November 2026)

Apply [Content Production Standard §4A and §4B](./CONTENT_PRODUCTION_STANDARD.md#4a-learning-first-teaching-standard-understanding-and-teacher-effectiveness) to **every new or materially revised learning packet**:

- Decide from the official outcome and learners' prerequisites, not from a fixed list of content widgets. Select subject-appropriate modelling, guided practice, discussion, investigation, practical action, independent work and formative checks. State what observable understanding looks like.
- Draft a core explanation plus practical **support** and **extension** responses when useful. Grade and age guide readability and safety but do not predetermine each learner's actual ability. Explain meaningful steps and misconceptions rather than merely providing an answer.
- Produce teacher-ready materials from the same canonical source: preparation and resources (including low-cost alternatives), prompts, demonstration or board work, pacing guidance, accessible options, expected answers, assessment/observation and next-step remediation/enrichment. Do not require teacher, class or timetable context for independent content creation.
- Write each question with an answer or rubric, explanation, outcome reference, stable identity, difficulty/cognitive demand, mistake feedback and explicit eligible uses. Worked examples and revealed guided solutions remain learning resources, **not automatically formal-exam questions**. Reuse appropriate independent items for practice/quiz via the existing bank; preserve unseen/variant pools and existing security/release policy for formal exams. Do not build a duplicate question bank or pretend that integration is live based on a draft.
- Check both **learner understanding** and **teacher teachability** before packaging. Include appropriate misconception recovery and a reasonable transfer task; never report mastery or superior learning outcomes without real evidence.
- Compare educational quality on clarity, correctness, learner understanding, teacher time/usable support, inclusivity and affordability, not simply chapter volume or claims against other publishers. External comparative claims require actual research or pilot evidence.

**Acceptance signal:** the learner can explain, perform or transfer the intended skill at an appropriate level, and the teacher can prepare, deliver, check and intervene using the packet. Where this has not been tested with learners or teachers, mark it an editorial design objective, not observed effectiveness.

### Step 5 — Prepare the teacher and independent-learner versions from one master

- **Learner view:** simple flow — Learn → Explore → Practise → Check → Improve. Appropriate reading depth, feedback and offline/low-resource instructions where useful.
- **Teacher view:** exact outcomes, prerequisite diagnosis, lesson guidance, classroom prompts, board/visual guidance, materials, differentiation, answers and observation/marking criteria.
- **Scheme/lesson-planning use:** canonical content must be selectable from the relevant curriculum outcome and scheme lesson without forcing a timetable merely to prepare a lesson.
- **Assessments:** reference reusable outcome-linked question identities, not a fresh disconnected set for every lesson, quiz or exam.

**Deliverable:** one canonical source with well-defined views/derivatives; no duplicate parallel libraries.

### Step 5A — Produce three connected learning experiences, never three disconnected books

After the **mandatory KICD ↔ VibeSchool reconciliation has passed** and the master teaching unit is properly authored, organize the content by **educational purpose** as required by [Content Production Standard §4C](./CONTENT_PRODUCTION_STANDARD.md#4c-three-complementary-learning-experiences-core-learning-supplementary-practice-and-revision). These are *three linked experiences* from one master, not three independent manuscript copies or content stores.

| Stage | Authoring obligation | Consumer and verification |
| --- | --- | --- |
| **Core learning (textbook-equivalent)** | Write complete explanation/exploration, age-appropriate visuals/demonstrations, fully reasoned worked examples, guided-to-independent attempt, misconception recovery, real teacher notes | Teacher Plan/Guide/Notes + independent learner content; verify comprehensible lesson and actual outcome link |
| **Supplementary practice (activity-book-equivalent)** | Author targeted, varied, accessible and gradually independent activities, worksheets or performance tasks with correct solutions/rubrics; offer remedial and enrichment variants | Teacher assignment/exercise, learner Topic Practice/worksheet/home activity where appropriate; check answer, feedback, and question identity/eligible uses |
| **Revision (revision-book-equivalent)** | Author retrieval and mixed-transfer checks for **already taught and source-verified** outcomes, concise accurate reminders and a wrong-answer → exact lesson → supported practice → fresh check pathway | Existing revision/Topic Practice/assessment surfaces where available; verify mappings, honest completion state, feedback, fresh items and safe exam separation |

**Delivery order:** author and quality-check the **core** teaching source first; design outcome-appropriate supplementary activities second; derive revision plans/items and links third. Do not rush into hundreds of generic exam questions to make an incomplete core lesson appear complete. The three experiences may be packaged as one release candidate, but each function, eligibility and status must remain separately inspectable.

**Pedagogical acceptance:** (a) learners can understand a new idea from core content; (b) learners with different prerequisites can practise it with useful feedback and support; (c) learners who have studied it can later retrieve/apply it and identify what to relearn; (d) teachers can prepare, deliver, differentiate and respond from the same source. This is an editorial acceptance target until demonstrated in actual teacher/learner tests.

**Revision-policy detail:** revision is not a protected exam by default; use mixed, spaced and application questions when suitable and show answers according to the formative policy. Do not automatically score old worked examples as independent mastery, expose formal exam answers, copy legacy KCPE revision questions into current CBC/CBE content, or claim a new revision interface has been deployed merely because a manuscript exists.

**Traceability:** store or reference core publication/chapter/resource ID, supplementary activity or question IDs, revision coverage/item IDs, linked outcome and Scheme/teacher contexts, question exposure/version/eligibility, learner feedback and observed evidence. If a consumer is not connected, mark it **NOT_CONNECTED** with an exact repair target; if no learner has studied the outcome, mark learner-specific revision status **NOT_YET_TAUGHT**, not 'complete'. Do not create a duplicate bank or make teacher timetables compulsory for authoring.

**Illustrative example:** Grade 4 Mathematics Time: core model of reading an analogue clock; additional clock-reading practice with accessible alternative and feedback when a learner confuses the hands; later revision across verified taught Time outcomes, with a wrong-answer link to the specific explanation, targeted exercise and a fresh check. Treat that example as pedagogy, not as a verified official KICD allocation.

**Deliverables:** a three-experience manifest per included outcome, teacher/learner derivative references, answer checks, any learner-specific evidence actually observed, missing-component dispositions and honest visibility/release states.

### Step 6 — Check, repair and package

ChatGPT performs a **clearly labelled self-check** for:

- Every declared outcome represented and genuinely taught, practised and assessed.
- Correctness of every key fact, example, **each mathematical working step**, any formula/symbol definition and substitution, final calculation, units and answer/marking guide.
- Usability for a child studying independently and for a teacher preparing the lesson.
- Relevant activities and practical instructions are feasible, inclusive and safe.
- Appropriate Kenya-specific examples, language, scope and progression.
- No filler, repetition, placeholder media, invented citations, unearned `verified` or missing meaningful parts.

Create a **short defect list**, repair the affected section, and re-check the affected evidence. Record **author self-review** as self-review, not independent endorsement. Existing release-critical independent verification is still required when the canonical publishing policy calls for it.

**Deliverable:** content package with outcome map, instructional material, answer key, teacher guide, status and evidence references.

### Step 7 — Integrate through current VibeSchool, not a new platform

- Check the actual current canonical contracts before technical changes. Follow the existing **curriculum authority → curriculum map → content chapter/resource → scheme/lesson links → learner reading/practice → assessment/progress** relationships.
- If the task is **content creation only**, hand over the package and exact integration target; do not pretend it is already in the database.
- The **default operator is ChatGPT in the conversation**. The solo owner should not have to visit HQ, select resources, manually upload visual files or repeat approvals for routine production. Where connected GitHub, Supabase or a scoped authenticated storage/publishing action is available, ChatGPT should use it directly, record exact evidence and complete the steps it can actually execute. **HQ is an optional admin UI, not the required authoring path.** See the [Visual Learning Library operator contract](./VISUAL_LEARNING_LIBRARY.md#canonical-operator-decision--chat-first-hq-optional-12-november-2026).
- If the owner requests **GitHub integration or publishing**, use available connected tools, existing schema, isolated branches, tests, quality/release policy and actual deployment/reader verification. Never treat repository access as automatic permission to bypass protected storage or content release controls.
- Teacher prep **without a timetable** is valid; scheduled delivery/attendance uses the real timetable occurrence.
- For visual assets, distinguish a brief, an image created in chat, a file actually stored in VibeSchool, a certified resource and a confirmed learner-visible asset. If this chat cannot upload image bytes through an authenticated operator-safe path, report `ASSET_CREATED_NOT_STORED` and the exact capability gap, without redirecting routine work to the owner or inventing a storage receipt.
- Do not set a learner-visible or verified status by editing prose or fabricating an approval.

**Deliverable:** accurate status `DRAFTED`, `CONTENT_COMPLETE`, `SELF_CHECKED`, `INTEGRATED`, `RELEASE_AUTHORIZED`, `PUBLISHED`, or `LEARNER_VISIBLE`, each only if directly supported.

### Step 8 — Move to the next subject

Report completion using **scope and evidence**: what grades/strands/outcomes were actually covered; actual content produced; where stored; which links work; what is not yet verified/published. Then proceed to the next requested subject or batch. Do not spend days upgrading orchestration instead of delivering educational materials.

## 4. The standard learning unit / content package

Use the [Content Package Template](./CONTENT_PACKAGE_TEMPLATE.md) as the reusable manifest. Each learning unit should include the fields required by its outcome:

| Content field | Why we need it |
| --- | --- |
| Grade, subject, strand, sub-strand, outcome ID | Clear curriculum identity and reuse |
| Learner title and purpose | Learner knows what they are learning |
| Explanation and vocabulary | Learner can understand without a separate textbook for the basics |
| Example or demonstration | Makes the skill or idea concrete; Mathematics examples require ordered working, explanations of **why** every essential step works, and correct formula/variable/units/check where applicable |
| Visual aids / diagrams / illustrations | For applicable outcomes: exact visual brief, real asset, labels/alt/caption, placement and canonical Visual Learning Library ID once created |
| Activity/inquiry/experiment/performance | Learner does something meaningful |
| Practice and exercise | Builds fluency and understanding |
| Questions and assessment evidence | Reveals what the learner has learned |
| Answer/explanation/rubric | Enables useful feedback and marking |
| Misconceptions, feedback, remediation and enrichment | Helps a learner improve |
| Teacher prompts, resources and differentiation | Enables classroom use |
| Source and canonical linkage | Supports curriculum tracing and integration |

Not every field produces a separate user-facing button. The unit is assembled as a coherent learning experience.

## 5. Production cadence and priorities

**Priority order:**

1. Produce actual learner/teacher-ready curriculum content for a requested grade and subject.
2. Complete its outcomes and teaching/practice/assessment coverage.
3. Reuse the content canonically in teacher and learner journeys.
4. Fix defects and verify actual access.
5. Only then consider optional production automation.

**Working pattern:** one grade/subject mission at a time, using sensible sub-strand batches. Parallel subject research/drafting may be done when it does not create conflicting content versions. The source map is written once, reused for all sub-strands and updated when official evidence changes.

A response may deliver a complete subject or a bounded batch depending on source availability and content volume; **do not label a partial batch “full curriculum completed.”** Maintain a clear ledger of remaining outcomes instead of restarting research from scratch.

**What we intentionally postpone:** new Cyborg worker orchestration, scheduling, multi-agent simulations, new content queues, duplicated quality engines, extra dashboards, and speculative platform features solely to enable content generation. Use existing facilities whenever actual integration needs them.

## 6. No owner bottleneck

The owner decides **what to produce next**, not the wording of each lesson. ChatGPT should not request repeated confirmation for curriculum source selection, normal authorship details, exercise design, ordinary corrections, or the next sub-strand within the requested scope.

Make reasonable editorial choices from the learning outcome and agreed standard. Investigate ordinary uncertainties; when source evidence is missing, state exactly which claim is uncertain and continue everything else. Avoid arbitrary word counts, compulsory videos, fixed counts of exercise questions, or mandatory separate media for every lesson.

This **does not** convert an interactive chat into a continuously running background worker; it does **not** guarantee a later delivery without a new conversation turn or a scheduled automation. For an in-chat task, produce the requested content **in the response/work session**.

## 7. Quality, roles and release honesty

The working roles are **authoring and review lenses**, not independently credentialed professionals. A ChatGPT self-check, even performed several times with different role prompts, is **not independent assurance**. Do not fabricate a human quality signature, source verification, content access, learner feedback, runtime check or test result.

Where a material defect is found, correct it and reverify; where independent release evidence is required, distinguish a **ready-for-review package** from an **approved/published** package. Routine authoring itself must not be blocked while unrelated approval/release steps are still pending.

The VibeSchool owner should receive a precise **production report**, not a list of approvals they must personally perform.

## 8. Migration back to Cyborg later (not now)

Reconsider automated content workers only when there is evidence of an actual bottleneck: large recurring throughput, repeatable quality checks, many concurrent subjects, revision pipelines or operational costs that justify automation. Then:

1. Reuse this outcome contract and master content package.
2. Reuse the existing Content Engine, quality system, Worker Engine and canonical governance, not a second platform.
3. Automate bounded, measured functions one by one.
4. Preserve editorial/release evidence and learner-facing quality.
5. Record a new explicit operating decision before changing any live worker or publishing authority.

**Until then: ChatGPT authors; VibeSchool's existing canonical system stores and delivers; genuine checks and authorized release determine what is live.**
