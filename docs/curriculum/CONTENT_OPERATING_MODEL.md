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

`OWNER SELECTS GRADE + SUBJECT → OFFICIAL CURRICULUM MAP → COVERAGE LEDGER → SUBJECT BLUEPRINT → ORIGINAL CONTENT → ACTIVITIES + PRACTICE + ASSESSMENT → TEACHER/LEARNER DERIVATIVES → SELF-AUDIT + TARGETED REPAIR → CANONICAL CONTENT PACKAGE → EXISTING RELEASE PROCESS → REAL READER/JOURNEY CHECK`

### Step 1 — Owner picks the subject; no long setup

Accept a simple request such as **“Grade 4 English: produce the complete KICD-aligned VibeSchool version.”** Use the grade, subject and agreed Grades 1–9 standard. Do **not** ask again for approval, every strand, every question count or formatting preference already governed by this document.

If the request explicitly covers a term or one topic, respect that scope. Otherwise plan the **complete declared subject**, not a disguised single-lesson pilot.

### Step 2 — Find the correct curriculum and list its full scope

- Retrieve the relevant official KICD curriculum design and identify the revision, grade, subject, all strands/sub-strands, outcomes, competencies, learning experiences and assessment expectations, plus lesson allocations if given.
- Cross-check against existing VibeSchool curriculum mapping to prevent duplicates, wrong-grade links and missing outcomes.
- Construct an **outcome coverage ledger** for the whole declared scope **before** claiming completeness.
- Identify gaps or uncertainty from the source. Continue preparing what is verifiable; do not invent exact outcomes, allocation counts or source checks.

**Deliverable:** one source-referenced, complete curriculum map/coverage manifest.

### Step 3 — Build the subject teaching blueprint

For each sub-strand, plan a meaningful sequence of outcome-linked learning units. Choose what **needs** notes, worked examples, diagrams, practical activities, experiments, discussions, projects, exercises, questions, quizzes, performance tasks, remediation or revision. Do not pad an outcome to match a fixed number of tools.

**Deliverable:** sub-strand and lesson sequence with purpose, prerequisites, estimated instructional scope, assessment method and outcomes.

### Step 4 — Write the actual learner content

For each unit provide, when relevant:

1. **Learning goal** stated naturally for the learner.
2. **Clear explanation** with key vocabulary and background knowledge.
3. **Worked/concrete example** showing reasoning, procedure or performance.
4. **Meaningful activity or inquiry** with instructions, materials and what to observe/do.
5. **Guided practice and independent exercise**, appropriate to age/skill.
6. **Questions and assessment** aligned to the taught outcome, with correct answers/explanations or rubrics.
7. **Feedback and common-error correction**, plus a brief remedial and enrichment path.
8. **Summary/revision** where appropriate.

For Creative Arts or physical outcomes, a demonstration, practical performance and observation rubric may take precedence over a long written exercise. For Mathematics, worked steps, learner practice and independent answer verification are especially important.

**Deliverable:** real readable content, not empty headings, a curriculum listing, one paragraph of notes or a promise of future generation.

### Step 5 — Prepare the teacher and independent-learner versions from one master

- **Learner view:** simple flow — Learn → Explore → Practise → Check → Improve. Appropriate reading depth, feedback and offline/low-resource instructions where useful.
- **Teacher view:** exact outcomes, prerequisite diagnosis, lesson guidance, classroom prompts, board/visual guidance, materials, differentiation, answers and observation/marking criteria.
- **Scheme/lesson-planning use:** canonical content must be selectable from the relevant curriculum outcome and scheme lesson without forcing a timetable merely to prepare a lesson.
- **Assessments:** reference reusable outcome-linked question identities, not a fresh disconnected set for every lesson, quiz or exam.

**Deliverable:** one canonical source with well-defined views/derivatives; no duplicate parallel libraries.

### Step 6 — Check, repair and package

ChatGPT performs a **clearly labelled self-check** for:

- Every declared outcome represented and genuinely taught, practised and assessed.
- Correctness of every key fact, example, calculation and answer/marking guide.
- Usability for a child studying independently and for a teacher preparing the lesson.
- Relevant activities and practical instructions are feasible, inclusive and safe.
- Appropriate Kenya-specific examples, language, scope and progression.
- No filler, repetition, placeholder media, invented citations, unearned `verified` or missing meaningful parts.

Create a **short defect list**, repair the affected section, and re-check the affected evidence. Record **author self-review** as self-review, not independent endorsement. Existing release-critical independent verification is still required when the canonical publishing policy calls for it.

**Deliverable:** content package with outcome map, instructional material, answer key, teacher guide, status and evidence references.

### Step 7 — Integrate through current VibeSchool, not a new platform

- Check the actual current canonical contracts before technical changes. Follow the existing **curriculum authority → curriculum map → content chapter/resource → scheme/lesson links → learner reading/practice → assessment/progress** relationships.
- If the task is **content creation only**, hand over the package and exact integration target; do not pretend it is already in the database.
- If the owner requests **GitHub integration or publishing**, use available connected tools, existing schema, isolated branches, tests, quality/release policy and actual deployment/reader verification.
- Teacher prep **without a timetable** is valid; scheduled delivery/attendance uses the real timetable occurrence.
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
| Example or demonstration | Makes the skill or idea concrete |
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
