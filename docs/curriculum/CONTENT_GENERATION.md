# VibeSchool Originals — Single Canonical Content Generation Playbook

**Version:** 1.2 — 12 November 2026
**Owner-approved educational direction:** Top-class, VibeSchool-original, KICD-aligned learning that demonstrates learner understanding and genuinely helps teachers teach.
**Applies to:** ChatGPT-led generation and material revision for Grades 1–9, all subjects, outcomes, terms, teacher resources, learner materials, exercises and revision. Other grades require their own applicable official curriculum authority.
**Role:** ONE required start-here operating document for all VibeSchool educational content-generation chats. Use it in full. Do not choose competing instructions from several independent checklists.
**Nature:** Editorial/production policy only. It does not change application code, database permissions, content-engine publication, runtime/worker authority or certification requirements.

> **Governing rule: Verify KICD against the actual VibeSchool curriculum → repair discrepancies → inspect and reuse canonical libraries → author Core + Supplementary + Revision + Teacher Support together for each outcome → verify answers, media and pedagogy → save and link using existing identities → check actual delivery → advance to the next outcome. The learning product is understanding, not the quantity of content.**

## 0. One entry point, existing specialist contracts

**Start every content-generation request here.** This document unifies the approved **educational work order and acceptance gates**, rather than replacing technical source-of-truth contracts or GitHub engineering governance.

- **This playbook:** authoritative sequence, content package, cross-library handoff, evidence/status and educational completion criteria for all content-generation chats.
- [Copy KICD Curriculum — Private Source Transcription Contract](./COPY_KICD_CURRICULUM.md): separate **source-ingestion and word-for-word verification appendix** for the restricted internal KICD reference layer, when permitted; it is **not** a second learner-content workflow, source-of-truth database or publication authorization.
- [Content Production Standard](./CONTENT_PRODUCTION_STANDARD.md): deeper pedagogical examples, subject-specific accuracy and assessment criteria. Use as supporting educational detail, not a different work sequence.
- [Content Operating Model](./CONTENT_OPERATING_MODEL.md): ChatGPT-led staffing and practical execution/handoffs, subordinate to this playbook's single content-generation loop.
- [Content Package Template](./CONTENT_PACKAGE_TEMPLATE.md): optional detailed recording format for the **same** outcome package and coverage ledger; not another parallel approval system.
- [Visual Learning Library](./VISUAL_LEARNING_LIBRARY.md): **technical authority** on canonical visual resource identity, version, storage, approved asset lifecycle, and certified-only image rendering.
- [Teaching Library Linkage](./TEACHING_LIBRARY_LINKAGE.md) and lib/teaching/libraryStructure.ts: **technical authority** on the 15 optional teaching-resource slots, resource-kind metadata, scheme links, certification and actual teacher discoverability.
- lib/assessment/questionBank.ts, canonical assessment definitions/items and their current database contracts: **technical authority** on existing bank promotion, reuse, answer access and formal examination rules.
- Root AGENTS.md, Cyborg executor and control-plane policy: **higher-priority authority for repository mutation, PRs, CI, security, release, independent assurance and production changes**. Educational authoring is ChatGPT-led; code or database writes still follow engineering governance.

**Conflict rule:** Official curriculum and factual evidence govern learning scope; current verified canonical repository/database contracts govern identity and integration; applicable legal/rights/safety/release rules always apply. Within *content-generation workflow* use this one playbook; if a supporting document diverges, record the contradiction and update the related documentation rather than silently choosing the easier version. Do not rewrite or weaken a technical, security or release contract from editorial prose. Keep the supporting files for detailed specifications; no one must search several files just to learn the normal production sequence.

## 0A. HQ-optional curriculum checking — interim solo-owner operating decision (12 November 2026)

**HQ is NOT a prerequisite for the non-mutating research, drafting or checking of educational content.** The owner is not using HQ as a daily operating desk. An unavailable or unused HQ dashboard, HQ worker, HQ staff member, HQ work item, timetable or HQ session must **not** itself produce `BLOCKED_CURRICULUM_RECONCILIATION` for an otherwise checkable editorial scope.

**Use the existing authority and evidence, not a second curriculum or approval engine.**

1. **Check outside HQ:** use the actual KICD design and its edition/page locators; inspect the current GitHub curriculum map and existing canonical Supabase outcomes through authorized read-only tools; prepare the source-to-outcome comparison ledger. Check learning outcomes, inquiry questions, experiences, competencies, values, PCIs, allocations and assessment scope. Grade/strand/sub-strand checking can be performed in chat, a local checkout or GitHub CI without signing into HQ.
2. **Check teaching content outside HQ:** run the existing canonical checks for identity, outcome packages and quality (`npm run check:content-without-hq`), plus outcome-specific answer/worked-step, diagram, language, accessibility, rights and teacher/learner tests. This command checks repository contracts **only**; it does not independently authenticate an official KICD PDF, read the production database, satisfy runtime delivery tests or award certification.
3. **Keep distinct statuses:** editorial checks may report `EDITORIAL_CHECKED` only with reproducible evidence; source comparison may report `CURRICULUM_MATCH` only for a declared scope whose actual KICD source and canonical VibeSchool records were compared successfully. Otherwise use `NOT_CHECKED`, `PARTIAL` or `BLOCKED_CURRICULUM_RECONCILIATION`, naming the missing evidence. Never claim a complete subject from a candidate hierarchy, unverified transcription, green unit test, or a privately drafted outcome.
4. **Keep all protected mutations protected:** official source registration, protected artifact intake and retention, snapshots, canonical identity/authority binding, outcome promotion, resource version certification, question-bank approval, publishing and learner-visible release must still use the **existing** role-gated, auditable workflows and current required proofs. An authenticated owner-approved client or service entry point outside the HQ user interface may be used **only if it already exists and is explicitly authorized for that action**; do not invent a token, reuse service-role powers to impersonate the owner, run privileged SQL to bypass `hq_assert_owner`/`is_platform_owner`, or replace the authority RPCs. The interface is optional for checking; **authorization is not optional for protected actions**.
5. **Do not hold safe drafts hostage to an unrelated approval:** where the exact source-to-canonical crosswalk is not yet confirmed, research and prepare clearly marked **unverified editorial working drafts** and tests as appropriate, but hold publication, outcome-verification assertions and any gate-dependent certified lesson claims. If a consequential step genuinely requires a currently unavailable owner-authenticated path, record `BLOCKED_AUTHORITY` or `BLOCKED_ACCESS` for that step only; continue independent, non-mutating checks in the meantime. This is not permission to skip mandatory Gate ZERO when certifying a lesson package.

**Operational separation:** `KICD + existing canonical data → independent checks + evidence → original draft + quality audit` runs without HQ. `Official authority write → certification → publication` stays behind existing approved owner/service security boundaries. Defer HQ integration until the owner elects to operate HQ; do not activate HQ workers, create new roles or build a shadow approval service solely for this curriculum-checking decision.

## 1. The non-negotiable mission

1. A learner must be able to **understand, explain, demonstrate, apply and progressively retain** the relevant outcome, at an appropriate level of support.
2. A teacher must be able to **prepare, explain, model, manage activities, check understanding and intervene** using real, ready-to-use support.
3. All material must be **correct, original, age- and ability-sensitive, inclusive, accessible, purposeful, culturally relevant where helpful, and appropriately safe**.
4. Curriculum fidelity must be **provable, outcome-by-outcome**, rather than a heading or marketing claim.
5. A page count, an exercise count, a bank item count, views, a generated file, a GitHub merge and a learner's unverified clicks are **not** proofs of understanding, teacher effectiveness or live publication.

**Two distinct content layers (never conflate them):** The **private KICD authority reference**, where the intended digitisation is covered by verified applicable permission, must preserve the source **word for word** and retain the original order, punctuation, numbering, tables, captions, footnotes and appendices; follow [COPY_KICD_CURRICULUM.md](./COPY_KICD_CURRICULUM.md). The **VibeSchool learner/teacher content layer** must contain original explanations, examples, activities, graphics, instructions, questions, feedback and teacher guides, **not a public clone of KICD or textbook passages**. Restricted storage does not independently confer copying rights; keep the scope of confidential permission recorded and checked in the authorized workflow. Do not claim formal KICD approval unless independently established.

## 1A. Plain, friendly language in ALL educational materials

**Separation is mandatory:** official source names, codes, version numbers, source URLs and verification evidence belong in restricted administrative metadata and governance reports, **not** in the learner or teacher's educational material. Keep internal curriculum outcome IDs and question IDs unchanged so lessons and exams continue to link correctly; change only their visible labels. Do not remove legally required attribution: where required, place it in a separate suitable credits/legal notice rather than inside an explanation or diagram.

**Never print these inside educational experiences:** the name KICD, raw codes such as VS-G4-MA-1.1-01, UUIDs, database keys, backend status strings, asset placeholders, source file paths, software/development terminology, AI prompt notes or curriculum verification discussion. This rule applies equally to learner notes, teacher notes, practice, worksheets, question stems, answer review, teacher preview, diagrams, image labels and alt text, downloaded or printed content and instructional slide visuals. **It does not remove KICD from private source records, authoring governance, audit evidence or legally necessary notices.**

**Use natural titles:** “Grade 4 Mathematics — Place Value”, “Lesson: Reading a Story”, “Our learning goal”, “Example 1”, “Activity 2”, “Revision: Time”, “Question 4”. A teacher may see ordinary strand/topic labels when relevant, but not a source code. Choose the learning language suited to the subject, explain real subject terminology and avoid childish oversimplification. Derive labels from the verified learning idea, never invent a second database identity.

**Child-friendly example:** “Look carefully: In 24,315, the digit 4 means 4,000 because it is in the thousands place. Try it: What does the digit 3 mean? Answer: 300, because it is in the hundreds place.” In artwork use labels such as “Thousands | Hundreds | Tens | Ones”, not an internal curriculum identifier. This example illustrates wording; it is not proof of a verified curriculum record.

**Presentation evidence:** review actual rendered teacher and learner screens, printable/exported materials, accessible descriptions, question feedback and images. If a raw code or source label currently appears, log and fix the application display defect separately; a Markdown instruction is not a live interface fix.

## 1B. Human Roles, Learning Differences and Real-World Workability Standard

**The human acceptance law:** A lesson is not complete solely because facts and curriculum coverage are correct. For its intended audience it must be understandable, teachable, usable with realistic resources, accessible, assessable and repairable. This is a **single verified outcome package with role-appropriate views**, not a separate curriculum, content engine, question bank or duplicate lesson for every role.

**Select all relevant audiences for the declared content, explain genuine exclusions, and test representative actual use.** Content authoring should not assume every learner is the same age, speaks the same language, owns a device, has attended school continuously, can write by hand or has a trained adult present. Do not assign rigid learning-style categories or infer a disability from performance.

| Role or person | What the relevant VibeSchool material must make possible | Minimum evidence for a claim of workability |
| --- | --- | --- |
| **School-linked learner** | Independently read or experience an accurate explanation, try an appropriate task, get meaningful feedback and understand what comes next without needing a teacher to reconstruct missing content | Actual learner route, age-appropriate clear instructions and correct activity/feedback |
| **Independent or home learner** | Learn without class, teacher approval, timetable or scheme dependency where access policy permits; receive self-explanatory examples, answers and hints at the right time | Independent-reader and practice flow tested, not inferred from teacher preview |
| **Learner catching up or returning after interrupted schooling** | Diagnose relevant prerequisites without shame; access earlier foundational explanations and graduated support while preserving their current enrolment/grade identity | Real prerequisite task, suitable remedial path and fresh check; no forced grade reassignment |
| **Learner needing accessibility adaptations** | Access equivalent learning through readable text, descriptions, appropriately keyboard/screen-reader-compatible materials, captioned/transcribed audio when used, and suitable written, oral, tactile or practical alternatives | Relevant actual accessible format and interaction checked; do not claim universal accessibility without testing |
| **Learner ready for greater challenge** | Apply knowledge in fresh, deeper or open-ended tasks without busywork or prematurely advancing to unverified learning objectives | Meaningful extension task and valid assessment criterion |
| **Classroom teacher** | Prepare and deliver an accurate lesson with complete notes, teaching aids, questions, expected responses, misconceptions, differentiated tasks and realistic timing/materials | Teacher can use complete actual content with ordinary class constraints and no required reconstruction |
| **Independent tutor or tuition teacher** | Use the same authoritative content for individual or small-group teaching, adapt pacing, practise, assess and follow up without pretending tuition is a separate curriculum | Correct authorized tutor/teacher resource access and appropriate reuse, without invented student links |
| **Parent or guardian** | Follow simple optional home-support directions, understand what skill a child is practising, offer encouragement, check safely released answers and know when a teacher or specialist is needed | Clear, short, jargon-free home instructions and appropriate answer/help access; never require an adult to be a qualified teacher |
| **Headteacher, school administrator or academic leader** | Understand outcomes, scope, gaps, delivery readiness and class-level resource needs where the existing role and permissions permit | Role-appropriate aggregated/authorized evidence; do not disclose protected learner records or exam solutions |
| **Examiner, assessor or marking reviewer** | Access a correct blueprint, question origin/eligibility, answer key, marking guidance, scoring criteria, difficulty and misconception information under controlled authorization | Actual protected reviewer route, verified scoring and no answer disclosure to learners |
| **Content author, editor or subject reviewer** | Inspect official source coverage, educational correctness, originality, version history, visual/answer accuracy, defects and the exact source-to-content evidence | Recorded original source/outcome lineage, review findings and corrected version |
| **Support or safeguarding personnel** | Locate only the approved accessibility/safety guidance needed for their authorized duty, with no new role access or privacy assumption | Existing scoped permissions and applicable child-safety/privacy policy; mark untested |

### Four mandatory human acceptance questions

1. **Learner:** Can the intended learner actually understand, attempt, check and improve, including independently and with suitable support?
2. **Teacher or tutor:** Can the educator deliver this accurately using the supplied materials, realistic time and ordinary resources?
3. **Home supporter:** Where home support is relevant, can an untrained adult follow brief helpful guidance without seeing privileged school data or becoming the sole teacher?
4. **Assessor or quality reviewer:** Can authorized reviewers accurately judge learning from real performance, with a valid rubric/answer authority and preserved exam integrity?

These are **perspectives**, not four compulsory interfaces or four newly created user roles. Test the relevant roles with existing authorized experiences and record NOT_CHECKED, NOT_CONNECTED or NOT_APPLICABLE with reasons where evidence is absent.

### Practical conditions that every relevant package must consider

- **Prior knowledge and pace:** Provide a simple diagnostic, at least one meaningful scaffold and suitably challenging next step when warranted. Do not equate age, class or a single wrong answer with ability. Keep the learner's existing grade identity intact.
- **Language and comprehension:** Use the correct teaching language; for English, Kiswahili and other languages, ensure explanations and examples are linguistically accurate and culturally respectful. Provide short vocabulary help and a meaningful language-support option where needed. Do not invent a translation or imply it has been checked.
- **Accessibility and inclusive response:** Consider sight, hearing, mobility, neurodiversity, literacy and other needs without stereotyping. Use real labelled visuals with alt text, readable typography, supported captions/transcripts for actual audiovisual content, clear instructions and oral/typed/tactile/practical response options when consistent with the outcome. Accessibility claims need practical testing.
- **Limited resources:** Prefer affordable local objects and alternatives to specialized apparatus, printers, textbooks, paid media and constant supervision. State safety precautions for tools, science and physical activities. Do not create a required external purchase.
- **Mobile and shared-device use:** Confirm instructions, diagrams, answer entry and feedback remain understandable on a small phone. Where supported, respect privacy when devices are shared; never expose another learner's record or protected answer. A private in-app view is not an offline feature.
- **Connectivity and data cost:** Keep assets efficient and provide meaningful text alternatives when practical. Mark offline, download, low-bandwidth, audio streaming and resumability as UNVERIFIED unless the actual product route is tested. Do not promise offline access merely because a worksheet is printable.
- **Real school conditions:** Teachers may handle large or mixed-ability classes, brief or altered periods, material shortages, interruptions and school-specific timetables. Offer realistic group-work/individual adaptations without forcing a timetable for curriculum browsing or unscheduled preparation.
- **Home and tuition contexts:** Offer optional brief parent/tutor guidance and low-cost activities; honor independent learner access and school/tutor permissions. No automatic sharing of a child's results or notes with adults.
- **Dignity, motivation and safety:** Use encouraging non-shaming language, honest progress feedback, inclusive examples and developmentally appropriate themes. Avoid pressuring students with false rank, fabricated mastery or punitive repetition.
- **Evidence and privacy:** Learning improvement requires real appropriate observations or responses, not clicks, generated worksheets or self-reported notebook completion. Collect only authorized necessary evidence; retain existing child privacy, school isolation and exam answer protections.

**Presentation rule:** All role-specific educational material remains VibeSchool-original and uses clear titles and everyday educational language. Source authority names, internal outcome codes, developer terms, private bank status and system diagnostics remain in restricted production records or legally necessary separate credits, never embedded in the lesson explanation or picture (§1A). A parent/supporter view may explain the skill in plainer language without altering its verified meaning.

**Usability acceptance:** For every authored outcome, record the relevant audiences, at least one realistic use scenario for each selected role, actual content available, needed adaptation, tested route where tools permit, and an explicit defect or untested limitation. Do not claim that all human roles are served merely because this table exists.

## 1C. Content Production Economics and Effectiveness Standard

**Disruption must be demonstrated, not declared.** The goal is to deliver a complete, correct, useful and reusable learning package for each verified outcome with less avoidable work and cost, while preserving human usability, rights, security and educational quality. No arbitrary 95%/100% readiness scores and no quality claims based only on volume.

### Measure the work honestly

| Measure | What to record or calculate | Interpret carefully |
| --- | --- | --- |
| **Full outcome cost** | Actual attributable authoring, model/tool, visual production, subject review, QA, correction, integration/storage and release costs where known; mark unknown costs explicitly | Do not report a low AI generation fee as the total cost when review or correction cost is unmeasured |
| **Time to usable content** | Elapsed time from verified source/outcome readiness to a complete checked and relevant-asset-ready package; separately to actual learner/teacher-visible release | First-draft speed is not end-to-end delivery speed |
| **Verified scope coverage** | Required outcome count versus reconciled and substantively content-complete outcome count, scoped to grade/subject/edition | Generated headings, topics or pages are not outcomes completed |
| **Question-bank yield** | Distinct items drafted → answer-checked → reviewed → actually bank-linked → permitted in protected exam, using the appropriate denominator at each stage | Question volume alone is not useful bank depth |
| **Rework and defect rate** | Meaningful content/answer/visual/label errors found, correction effort, regressions and rechecks per version | More defects found may initially reflect better checking rather than worse content |
| **Reusable-resource benefit** | Real certified resources reused across appropriate lessons, aids and approved contexts without duplicate identities or answer leakage | Count only genuine eligible reuse, not repeated links to unusable or protected material |
| **User workability** | Representative teacher/learner/parent/assessor tasks attempted, task success, meaningful barriers, time/effort observations, device/accessibility context | Role-specific user testing is different from code review or author self-assessment |
| **Learning effectiveness** | Appropriate evidence of independent explanation, transfer, retained knowledge, corrected errors and teacher observations when legitimately available | A quiz score, click or completion count alone does not prove causal improvement |
| **Equity and access** | Relevant barriers due to device, connectivity, language, disabilities, resources and independent status; proportion actually tested and fixed | Do not infer population-wide accessibility or coverage from one test user |

**Measurement discipline:**

1. Use **one canonical outcome package and existing evidence/analytics infrastructure**; capture fields in the current content ledger where available. Do not create a duplicate analytics, question or curriculum authority just for these metrics.
2. State source, timestamp, version, scope, denominators and missing data for every claimed metric. If cost, time, access or learning results are unavailable, state NOT_MEASURED rather than inventing amounts or scores.
3. Distinguish **draft → checked → independently reviewed where required → bank/resource linked → authorized → user visible → observed educational benefit**. The same distinction applies to costs, productivity and impact.
4. Compare production methods only with relevant equivalent scopes and accounting boundaries; record review and repair labor rather than claiming AI has eliminated it.
5. Prefer fixing a wrong explanation, broken aid, misleading answer or inaccessible lesson over hitting an output quantity or production-speed target. Neither content count nor bank count is a substitute for genuine learning.
6. Run small, representative end-to-end checks before scaling a subject; correct recurring weaknesses in the existing canonical playbook, materials and code. Use the existing authorized release and security gates for all publication.
7. Record reasonable user feedback and repair outcomes with proper privacy/consent handling. Do not claim causal learning gains without an appropriate comparison or enough real evidence to support the statement.
8. At topic, term and subject milestones, summarize verified coverage, accepted materials, question-bank yield, cost/time where known, role-tested workability, outcomes/feedback and blockers. Do not force the solo owner to manage a new dashboard or perform routine evidence entry.

**A content production pass succeeds educationally** when the verified scoped content is accurate and useful to its intended people, the relevant materials and links genuinely work, required release gates are met, and claims about cost, speed, reach or learner improvement are limited to measured evidence. **Productivity is an objective, not a reason to bypass instructional quality.**

## 2. Mandatory gate ZERO — KICD ⇄ VibeSchool curriculum reconciliation

**STOP CONTENT WRITING until this gate passes for the exact intended scope.**

### Mandatory private KICD source transcription and verification

When the task is to digitise KICD curriculum as a **private internal reference**, follow [COPY_KICD_CURRICULUM.md](./COPY_KICD_CURRICULUM.md) **before** deriving any VibeSchool curriculum fields. This is the only separate transcription contract; it does not supersede the content-authoring workflow below.

1. **Source-exact, not paraphrased:** In the restricted reference layer, preserve every accessible, authorized original word, mathematical symbol, punctuation mark, heading, table cell, source code/number, caption, footnote and appendix in the correct sequence. Do not turn a full design into a summary, candidate index, invented outcome or paraphrase. Keep PDF page number and printed page locator distinct and record source edition/version.
2. **Atomic inventory of *everything* present:** Include front matter, national/level goals, essence statement, general outcomes, weekly lesson allocations, all strands/sub-strands, each separate specific learning outcome, each suggested learning experience and key inquiry question, competencies, values, PCIs, cross-learning-area links, rubrics, assessment guidance, resources, visuals, implementation guidance, and appendices. If the official edition has additional sections, include them. Mark genuinely absent fields `NOT_IN_SOURCE` only with checked source pages; do not leave required fields empty or infer data.
3. **Rights and privacy gate:** The owner has stated confidential permission exists; that assertion is not independent rights verification. Record `RIGHTS_SCOPE_UNVERIFIED` until scope for digital transcription, private storage and provider access is established through authorized confidential review. Do not upload source text to the public GitHub repository, public API/client bundle or learner/teacher pages. Use existing access-controlled authority/artifact paths, not a duplicate database.
4. **Mandatory equality and readback:** Check page-by-page completeness and source-exact text against the actual official PDF, including tables and scan-dependent pages; record each item with its source page and stable canonical identity. Read persisted data back from VibeSchool and compare to source; do not infer completeness from a merged Markdown file or a success count.
5. **Fail-closed certification:** Any missing page, field, item, altered word, version conflict, unresolved permission scope or unverified storage/equality check prevents a **100% source-exact** claim. Record precise `BLOCKED`/`NOT_CHECKED` evidence and the remaining work. Source transcription verified, curricular reconciliation passed, original teaching material quality approved, and release authorized are **different milestones**.

**Operational boundary:** The word-for-word rule applies to the *private KICD reference only*. All downstream learner-facing/teacher-facing VibeSchool materials remain original, outcome-aligned and subject to existing quality/security/release gates. A written guardrail alone does **not** mean the ingestion or its automated checks have been implemented.

1. **Identify scope:** grade, subject, applicable curriculum/system, source design title and edition/date, language, term/strand/sub-strand/outcomes, official lesson-allocation guidance if present. If the owner names a whole subject, inventory the whole subject; if one topic, keep the boundary explicit.
2. **Read the actual official source:** locate and inspect the applicable authoritative KICD design, record URL/document, revision and exact pages or sections with access date. Do not infer outcomes from an index, a remembered design or a secondary book.
3. **Read actual VibeSchool curriculum:** inspect the canonical curriculum map and current persisted outcome records, not a prior chat claim or an isolated Markdown file. Read existing scheme/outcome references affected by changes. Keep teacher-owned Scheme of Work and timetable records separate from official curriculum authority.
4. **Compare line by line:** source strands, sub-strands, outcome meanings and scope, specific learning experiences and inquiry, competencies, values, applicable contemporary issues, assessment expectations, progression, suggested lessons and relevant differentiation. VibeSchool wording can be original but must preserve required intent and scope; do not invent lesson allocations.
5. **Record a reconciliation ledger:** source locator → stable VibeSchool outcome ID → MATCH / MISSING / PARTIAL / EXTRA / CONFLICT / NOT_CHECKED → required correction and evidence.
6. **Repair the canonical curriculum first:** resolve every MISSING, PARTIAL, EXTRA or CONFLICT affecting the intended scope through the existing authorized source-of-truth/migration process. Preserve stable IDs, school-owned schemes, historic evidence and unrelated records. Recheck the corrected canonical map, scheme links and affected consumers.
7. **Pass only with evidence:** every required source outcome in the declared content scope must be MATCH, with source and VibeSchool refs actually inspected. If source, data or authority cannot be accessed, report BLOCKED_CURRICULUM_RECONCILIATION for that scope; investigate normal mismatches without asking the solo owner to do routine checking. A separately reconciled smaller scope may proceed **only** with its explicitly narrower claim.

### Repair routine gaps before reporting a blocker

Work on the exact requested outcome or dated lesson. If a source, mapping, Scheme link or supported application function is missing, trace the dependency to its canonical record and use the authorized repair workflow. Check alternate official KICD source locations when a link fails. Reuse existing verified outcomes, register source evidence through the approved workflow, and repair a Scheme link only when the curriculum and teacher's intended allocation are supported by evidence. Preserve teacher-owned entries and historical links.

For scheduled work, confirm the exact occurrence, school term and instructional week. Check the live availability of the guarded attachment workflow. If a required migration is absent, verify its deployment prerequisites and use the approved migration path when authorized. Re-read the live records after each repair and rerun Gate Zero. When it passes, continue directly to authoring, verification and saving the draft.

Escalate only the specific gap that remains after authorized repair attempts, with the evidence checked, changes made, and the decision or access still required. A topic suggested by a textbook or a same-week Scheme entry alone cannot establish an official outcome or a dated assignment. Keep verified supplementary material clearly scoped to its supported outcome.

**Mandatory gate declaration:** “KICD ↔ VibeSchool: [grade/subject/scope], [official edition and pages], [matched N of N], [repairs and canonical IDs], PASS or BLOCKED.” For a private word-for-word ingestion also report: [source pages checked N/N], [atomic requirements N/N], [source-exact equality PASS/BLOCKED], [persisted readback PASS/BLOCKED], [rights-scope status]. Never write PASS from inference. **A curriculum PASS is not content quality approval or publication.**

## 3. Inspect all existing libraries BEFORE creating assets or questions

For each verified outcome, inspect what already exists in the **real canonical system** for the correct grade, subject, sub-strand, outcome, variant, language and version:

| Source / service | Reuse and checking obligation |
| --- | --- |
| **Curriculum Map / Scheme links** | Preserve verified outcome IDs and any legitimate existing scheme/lesson associations; timetable is NOT required merely to author or browse content |
| **Content Engine** | Look for current canonical publication, chapter, content blocks, outcome-associated learner notes, examples, activities and version; extend or repair, do not fork an unrelated content source |
| **Teaching Library** | Inspect active/certified reusable teaching resources and compatible personal-resource context; use exact asset_kind/material_variant metadata and real links; empty optional slots are not defects |
| **Visual Learning Library** | Find any accurate, licensed, readable diagram/image/chart/illustration to reuse under its actual certified resource/version identity; otherwise plan and create the needed real asset |
| **Question / assessment bank** | Inspect approved outcome-matched items, their correct answers, versions, feedback, exposure and permitted uses; adapt or author fresh items when needed; never blindly move revealed practice into protected exams |
| **Revision and learner evidence** | Inspect existing revision items/coverage and legitimately available practice/competency/mistake evidence; do not presume a new learner has studied a topic or has a mastery score |

**Decision order:** REUSE a correct existing item → UPDATE/REPAIR the authoritative existing resource/version through approved workflow if defective → CREATE a new original item only where the gap is genuine. Do not silently mutate an immutable certified version or a teacher-private item. Do not attach a wrong-grade, wrong-outcome, wrong-week, unpublished or uncertified resource simply because its title resembles the topic.

**Inspection is evidence-driven:** if a chat lacks authenticated access to current live libraries, record NOT_CHECKED or NOT_CONNECTED, describe the missing capability, and continue safe original manuscript preparation where the mandatory KICD reconciliation gate has passed. Never pretend inspection or storage took place.

## 4. The smallest production unit: ONE outcome, FOUR coordinated deliverables

**Complete the following in the SAME outcome production pass before proceeding to the next outcome.** This means one coherent package, **not** all core chapters first, then an exercise book weeks later, then a revision book. It also does not require an entire subject to fit in one response. Choose manageable topic/sub-strand batches and maintain stable identities and a ledger.

### 4.1 Core Learning — equivalent to a high-quality textbook lesson

- State the verified outcome in child-friendly language and explain why it matters. Diagnose prerequisite understanding and relevant vocabulary.
- Choose an evidence-informed, subject-specific teaching approach, not a rigid universal sequence: connect prior knowledge; explain or explore; model; guide; provide independent application; check; respond.
- Write **actual learner-ready prose**, not headings or a syllabus outline. Use logical progression and locally meaningful examples when useful. Avoid filler and formulaic AI phrasing.
- Include a complete worked example, demonstration, experiment, sample text, oral model or performance criteria where relevant. In Mathematics, **explain WHY every important step works**, choose formulas only when appropriate, define symbols, substitute values, show intermediate work, units, final answer and a valid independent check.
- Plan and create a real visual aid when it makes the concept easier or the outcome depends on it. Show correct labels and accessible text; a visual brief is not the image itself.
- Supply guided attempts, an independent/application check, precise likely misconceptions, correction and feedback.
- Where writing adds learning value, include a short child-friendly **write / draw / show your working** invitation before revealing the model or solution. For Mathematics, ask for intermediate steps, units and checking; allow accessible oral, tactile or typed alternatives.
- Prepare support/core/extension pathways based on actual learner prerequisites and needs, without hard-coding stereotypes by age, grade or a single wrong response.
- Produce practical teacher notes and guidance from **the same source**: purpose, prior knowledge, prompts, preparation, materials, classroom management, realistic timing, board/visual guidance, sample responses, differentiation, safety and observation/marking rules.

**Core acceptance:** a learner can encounter a complete explanation or equivalent accessible experience; a teacher can deliver it with the included guidance. A short paragraph plus ten questions is NOT a finished lesson.

### 4.2 Supplementary Practice — equivalent to a purposeful activity book

- Target the precise verified outcome or prerequisite, specify educational purpose: guided, independent, reinforcement, remedial, enrichment, project, worksheet, home activity or performance.
- Prefer activities that strengthen the skill: concrete objects, diagrams, discussion, writing, oral practice, calculations, investigations, games or practical demonstration. Do not default to MCQs for every subject.
- Sequence from accessible support toward independent application, then appropriate challenge. Select a **meaningful** number of questions, not a fixed artificial quota.
- Encourage learners to attempt, sketch or show their process in an ordinary exercise book before checking answers when educationally appropriate; do not require a printer, notebook upload or button attesting that writing is finished.
- Record correct answers with reasoning, sample responses/rubrics, error-specific feedback, retry hints and the teacher's next intervention; validate answers independently where feasible.
- Include short, clear home-use directions and low-cost/safe alternatives if suitable. Treat activities and exercises as useful instructional experiences, not mandatory separate apps.
- Preserve a stable activity/question source ID, version, outcome mapping, difficulty/cognitive demand, visibility/exposure and eligible reuse (lesson, worksheet, homework, topic practice, quiz or other permitted context).

**Practice acceptance:** it reveals or improves the target skill with constructive feedback. Mere repetition of the teaching example or a large question volume is inadequate.

### 4.3 Revision and Consolidation — equivalent to a revision book

- Draft revision **readiness** for the same verified outcome in the same pass: a concise accurate reminder, retrieval prompts BEFORE displaying explanations, a fresh or varied application/transfer question, correct answer or rubric, and a diagnostic next step.
- Ask for independent written/illustrated retrieval when suitable, followed by comparison, error correction and a fresh check; keep spoken, practical and accessible response modes valid.
- Distinguish **drafted for later revision** from **a specific learner has studied it**; never credit learner mastery or completion without real evidence. Revision can be voluntarily available according to access policy.
- Map each wrong or skipped response to an exact misconception/outcome, the core explanation or worked model, a suitable supplementary remedial activity, and a **fresh reassessment item**. Where actual UI routing is not verified, document the intended IDs and mark NOT_CONNECTED.
- At topic completion, assemble mixed and cumulative retrieval/application across the **verified included outcomes**. At term and declared-subject completion, assemble appropriate broader review, spaced/mixed practice and assessment blueprint with teacher revision guidance.
- Do not use historical KCPE material as if it were the current Grades 1–9 assessment authority. Do not copy restricted papers or leaked formal-exam items.

**Revision acceptance:** the learner can retrieve/apply what was taught and find the exact material needed for improvement, not just see a score.

### 4.4 Teacher Support — prepared in the same pass

Provide the actual aids selected for the outcome: **teacher Lesson Notes (distinct from full learner content; see §4.5)**, Teacher Guide, demonstration instructions, examples, visuals, discussions, assessments/observation, worksheets and assignments, differentiation, remedies and extension, with true outcome/resource IDs. Do not make every Teaching Library slot compulsory. Do not require a timetable for independent content, a scheme or unscheduled lesson preparation; a dated scheduled occurrence remains relevant to actual scheduled teaching/attendance.

**Teacher acceptance:** teachers can see, understand and use the applicable materials without rebuilding the lesson and without links to the wrong class, week, subject or outcome. Teacher guidance should identify when to invite learner working in an exercise book, what to observe or correct, and an accessible alternative.


## 4.5 Learner Content vs Lesson Notes — two views of one verified outcome

**Learning content** is the complete, learner-ready teaching experience for an outcome. **Lesson Notes** are an educational-content component used as a purposeful teaching reference. Notes alone are **not** the entire learning package. A Lesson Plan arranges how the teacher will teach; it is not the source of content.

- **Learner content** (existing `asset_kind=learner_notes` where appropriate) contains an original accessible explanation/exploration, vocabulary, real-life context, suitable diagram or demonstration, explained worked model, guided attempt, independent practice and constructive feedback. It must make sense to an independent learner, not only a teacher.
- **Teacher Lesson Notes** (existing `asset_kind=teacher_notes` where appropriate) help the teacher explain the same concept: focus, key facts and vocabulary, board/visual demonstration, explanatory steps, questions and expected answers, misconceptions and remedies, scaffolds/extension, and a brief formative check. The fuller Teacher Guide may separately cover timing, classroom logistics, inclusion, preparation and safety.
- **Produce and check together.** Facts, formulas, units, diagram labels, reasoning, questions/answers and exact curriculum outcomes must agree. Notes may summarize and link back to the full learner explanation; they should not be verbatim duplicate pages, a second syllabus or an unrelated book.
- **Canonical lineage:** retain the verified curriculum outcome and actual canonical Content Engine/publication and `learning_resources` / `learning_resource_versions` identities. If both resource types exist, each has its true resource/version ID and links back to the same outcome. Use existing `teaching_resource_links` and Scheme bridges where relevant. Never invent IDs or create a second content engine, assessment authority, or curriculum identity.
- **Delivery:** independent learners use released learner content in Learn; authorized teachers discover/read applicable version-checked Lesson Notes and follow links to the full content from Curriculum Map, Scheme, Teaching Library or Lesson Plan where supported. **Preparing and browsing notes never requires a timetable**; scheduled Teach Mode uses the actual occurrence.
- **Selection:** a dedicated teacher-notes resource is useful for many outcomes but is not a compulsory fifteenth-slot filling exercise. Provide substantive teacher guidance under §4.4, document instructional reasons for omissions and distinguish manuscript, stored, certified, linked and actually visible states.

### 4.5A Active notebook and learner-produced work — one shared architecture

**Teach → Try → Write/draw/do → Check → Correct → Retry** is an adaptable invitation, **not** a compulsory linear workflow, progress event, new database, assignment or marking engine. Choose the modality required by the curriculum outcome; a spoken explanation, manipulation, drawing or practical demonstration can be more appropriate than handwriting. Do not make handwriting a barrier for early grades or learners with disabilities.

- **Core reader / worked examples:** after a clear model, invite one similar attempt in an ordinary exercise book or on paper; for Mathematics ask for meaningful steps, method and units. Do not ask learners merely to copy the completed example.
- **Supplementary activities / exercises / Topic Practice:** before answer reveal or a low-stakes response, encourage a reasoned attempt or sketch, including support and corrections. Existing scored inputs remain the sole scored evidence; the optional notebook work is offline unless assessed through an existing authorised submission/observation route.
- **Revision / mistake recovery:** ask the learner to recall or solve independently first; compare with the explanation, correct the mistake, then attempt an appropriate fresh check. Opening, writing or clicking a confirmation alone earns no marks or mastery.
- **Teacher Lesson Notes, Teacher Guide, Scheme / Lesson Plan:** derive a concise board/exercise-book invitation and observable success criteria from the same outcome and resource version; no timetable dependency for preparation.
- **Subject adaptation:** Mathematics = method, steps and units; languages = original sentences/meaning/spelling; sciences = observation, labelled drawing and reasoning; arts/sports = practical creation/performance first, optional sketch/reflection. Offer oral, typed, tactile or other accessible alternatives.
- **Implementation authority:** use the shared `lib/learning/notebookGuidance.ts` + `components/learn/LearningNotebookPrompt.tsx` for VibeSchool learner surfaces. They display guidance only; do not create a second notebook table, duplicate question authority, self-reported completion control, grading RPC or unsupported resource link. Apply them only where a learner action is appropriate, not to formal-exam security screens.

**Outcome handoff evidence:** record the proposed active-work instruction, expected written/observable reasoning, misconception correction and accessible alternative in the existing canonical teaching package. Treat actual learner work/teacher observations separately from publisher prompts and preserve assessment release policies.

### Paired illustrative example — Grade 4 Mathematics: hours into minutes

**Illustrative educational example, not a verified KICD outcome, certified asset, or live VibeSchool resource.** Pass Gate ZERO and inspect current library records before adopting it as an actual content package.

**A. Learner content — full learning explanation**

> **Understanding hours and minutes.** We measure time in hours and minutes. **1 hour = 60 minutes.** The minute hand of a clock completes one full turn in 60 minutes. Imagine 3 groups of 60 minutes. We can add 60 + 60 + 60, or multiply because each group has the same number of minutes: **3 × 60 = 180**. Therefore, **3 hours = 180 minutes**. We can check by separating 180 minutes into three groups of 60.
>
> **Guided practice:** How many minutes are in 2 hours? Two groups of 60 give **2 × 60 = 120 minutes**. **Independent check:** Find the minutes in 4 hours. The answer is **240 minutes** because 4 × 60 = 240. If you got 400 minutes, remember that each hour has 60 minutes, not 100.

A certified and accurate clock illustration may support this explanation when its actual visual resource/version is available. A text description of an image is not an image.

**B. Teacher Lesson Notes — concise teaching reference**

| Notes field | Classroom-ready reference |
| --- | --- |
| Focus | Understand the relationship between whole hours and minutes and explain a conversion |
| Key fact and method | 1 hour = 60 minutes; minutes = number of hours × 60 |
| Board model | Draw three equal groups of 60; show 60 + 60 + 60 = 3 × 60 = 180 minutes; explain *why* multiplication works |
| Teaching prompt | “Why do we multiply by 60, not 100?” “How could you check 3 hours = 180 minutes?” |
| Expected response | An hour contains 60 minutes; three groups of 60 contain 180; each group can be checked |
| Misconception | 1 hour ≠ 100 minutes; point to clock divisions and rebuild groups of 60 |
| Support / extension | Use counters or drawn groups; extend to a simple duration context when ready |
| Formative check | 2 hours = **120 minutes**; 5 hours = **300 minutes**; ask learners to explain |
| Resource links | Same **verified** outcome; actual learner/teacher resource versions and permitted links (no made-up IDs) |

**Acceptance:** learner content should *teach the why* and guide practice; teacher notes should make the same learning teachable, assessable and correctable. Both share verified source lineage and checked mathematical answers, while serving different audiences.

## 4.6. Structured, classroom-ready Teacher Lesson Notes

Lesson Notes must be **finished teaching material**: ordered, easy to scan, instructional, accurate and directly usable. Do not pass a generic summary, curriculum outline, transcript of content blocks, empty headings, software labels or copied learner chapter as notes.

Prepare these elements in every relevant notes package; combine sections only when doing so improves the teaching:

1. **Friendly title and lesson focus:** grade, subject, topic and intended scope; duration/term/week only when actually known.
2. **Learning goal and success signs:** what a learner should be able to explain, read, write, solve or demonstrate.
3. **Prior knowledge:** short diagnostic question, likely learner starting points, key vocabulary.
4. **Materials and aids:** actual low-cost objects, linked illustrations, word cards, visual or texts; alternatives if equipment/printing is unavailable.
5. **Clear teacher explanation:** correct concept, why it works and what should be emphasized.
6. **Teaching sequence:** warm-up, modelling/exploration, guided practice, learner attempt, formative check and close, with realistic optional timing.
7. **Complete board model:** ready-to-write worked steps, diagram labels, explanatory sentences, reading passage, spoken script or demonstration instructions; maths needs meaningful intermediate steps, units and checking.
8. **Questions and expected answers:** actual opening, probing and application questions, model responses and useful follow-up prompts.
9. **Learner participation:** exact linked task, exercise-book writing or oral/practical alternative, and what the teacher observes.
10. **Quick check and marking guidance:** brief assessable check, accurate answer or performance rubric, and observable evidence of understanding.
11. **Misconceptions and remedies:** concrete likely mistakes, how to notice them, corrective model, appropriate supplementary activity and fresh check.
12. **Support and extension:** adjustments for prerequisite knowledge, ability, language, pace and accessibility, and a genuine higher-level challenge.
13. **Follow-through:** useful short assignment or revision prompt where relevant, what to revisit, and references to the same outcome and resources (IDs internal only).

A teacher must be able to teach from the notes without inventing a missing passage, example, answers, worksheet or visual. Teacher Notes are distinct from the fuller Teacher Guide and from complete learner Core content, but all must use the same checked knowledge and examples.

### Example layout — English: Describing words

**Learning goal:** Add suitable words that describe people and things.

**Explain:** “A describing word tells us something about a noun. Compare ‘a bag’ with ‘a heavy bag’.”

**Board model:** Write “The bird flew.” Then “The small bird flew.” Point to **small** and explain it tells the size of the bird.

**Ask:** “Which word describes the bird?” **Expected answer:** “small”. “What new idea does it give?” **Expected answer:** “The bird is small.”

**Learner try:** Write two original sentences using suitable describing words; accept a spoken or dictated response when appropriate.

**Quick check:** “The bright lamp shone.” Which word describes the lamp? **Answer:** “bright”.

**Correction:** If a learner chooses “shone”, ask which word tells what the lamp *did* and which tells what it is *like*. Practise with another familiar object.

This is a friendly example of how notes should look, not a verified claim about a specific lesson allocation.

## 4.7. Excellent English learning aids

English materials must be **complete learning experiences**, not vocabulary lists, isolated grammar questions or references to absent textbooks. Select the relevant components for the verified goal:

- **Reading:** original age-appropriate short stories, poems, factual passages, notices or dialogues, complete text, vocabulary in context, literal/inferential/critical questions, evidence-based answered examples and accessible reading support.
- **Listening and speaking:** complete read-aloud script or verified audio, listening instructions, pronunciation/intonation demonstration where relevant, dialogue and role-play cards, speaking prompts, observation criteria and useful oral feedback.
- **Writing:** demonstrated model sentences/paragraphs, authentic writing tasks, planning organizer, drafting and editing process, success checklist, sample responses and feedback/rubrics for open-ended responses.
- **Grammar, language use and punctuation:** clear explanation in context, worked correct/incorrect comparisons, original sentence transformation and editing, guided and independent practice, fully checked answers.
- **Vocabulary and spelling:** meaningful word banks, usage models, contextual examples, word-pattern cards, practical dictation and varied retrieval.
- **Visual teaching aids:** actual word/picture cards, story map, sequence organizer, labelled pictures, sentence strips, dialogue bubbles, punctuation chart, word web or reading organizer as useful; clear print and caption, no raw codes.
- **Extra practice:** support tasks, core tasks, richer extension, and relevant remedial/revision exercises tied to observed errors.

Do not force every English lesson to contain every strand. Where a passage, script, image or rubric is referred to, include that actual asset/content or a real verified link to it. Comprehension answers must match the authored text; composition/speaking require criteria and acceptable examples rather than pretending there is only one machine-gradable answer.

## 4.8. Complete Supplementary and Revision collections

**Supplementary practice:** build a purposeful packet for the exact skill: a short reminder/scaffold, model where necessary, guided tasks, independent exercises, contextual application, challenge where suitable, answer explanations or rubrics, hints, common-error correction, and a practical teacher/home-use option. Include real stimulus materials (tables, passages, images and objects instructions); never leave “refer to the picture” without a picture. Use varied written, spoken, drawn, manipulated and other accessible response modes rather than defaulting to MCQ.

**Revision:** prepare concise recall aids, fresh unaided retrieval questions before showing an answer, mixed applications across already verified outcomes, transfer questions, mistakes with explained corrections, fresh reassessment, spaced retrieval when supported and topic/term/subject collections. A revision packet is not learner mastery evidence. Keep a correct path from each weak skill to the specific core explanation, a suitable supplementary activity and a new check; mark a missing runtime link NOT_CONNECTED rather than implying it works.

**Acceptance:** learner and teacher should be able to complete the material without authoring missing instructions or answers. Reject duplicated filler, irrelevant exercises, copied revealed solutions as unseen questions and inaccurate answer keys.

## 4.9. Useful, real diagrams and illustrations

Create the actual diagram or other aid when instructional need justifies it: place-value charts, number lines, fraction models, clocks, measurements, shapes, labelled science observations, maps, sequences, story diagrams, writing organizers and picture cards. Prefer correct original reusable assets from the existing Visual Learning Library. The brief is not the image.

- Every visible label, arrow, caption and alt description must teach something; use simple ordinary subject words, accurate mathematical scales/units, high contrast, readable sizing and coherent mobile/print rendering.
- Use appropriate learner labels such as “Ones”, “Tens”, “Hundreds”, “Beginning”, “Middle”, “End”, “Character”, “Setting”, “Hour hand” and “Minute hand”.
- Do not place source names, development strings, visual resource UUIDs, hidden object tags, curriculum codes or generation instructions on artwork, caption or alt text.
- Do not leak answers into diagrams intended for an independent test. Separate worked-example pictures from unseen assessment stimuli.
- Verify the image actually exists, is accurate, is licensed, has its real canonical version/link and renders for the intended authorized audience. Do not mark a planned diagram as delivered.

## 5. The 15 Teaching Library slots — OPTIONAL, not content quotas

VibeSchool's actual taxonomy is in lib/teaching/libraryStructure.ts. This table provides a readable production reminder. These are navigation/linked-resource **roles**, not fifteen required components or fifteen new storage tables.

| Teaching group | Existing optional slots |
| --- | --- |
| **Teach & Explain** | Lesson Notes; Worked Examples; Illustrations & Diagrams; Demonstrations |
| **Explore & Participate** | Experiments; Discussions; Projects; Educational Games |
| **Practise & Apply** | Assignments; Homework |
| **Check Learning** | Quizzes; Tests & Exams |
| **Support & Improve** | Revision; Reflection; Remedial & Enrichment |

- Select only what is **instructionally useful**, with a brief outcome-based reason for omissions if the production package calls for it.
- Canonical reusable identity is in learning_resources; immutable version authority is learning_resource_versions; teaching_resource_links is the contextual teaching link, with scheme_lesson_resource_links where compatible. Teacher-owned private resources remain separate and subject to existing permissions.
- Use explicit supported asset_kind, material_variant or existing scheme-role metadata to classify. **Do not infer a slot solely from a title or generic “assessment/exercise” label.**
- Verify actual resource availability and **certified version** under current policies; an “active/public” root or an empty library slot does not prove a readable certified resource.
- Reuse the existing reader or approved text reader and real resource/version references. An unfilled slot must not block curriculum browsing, scheme creation, lesson planning, Teach Mode, attendance or assessment authoring.

## 6. Visual assets — inspect, create, register, link, VERIFY

Visual aids include diagrams, number lines, fraction models, clocks, maps, photos, illustrations, labelled sequences, charts and other accessible representations **when educationally justified**.

1. **Inspect/reuse:** look for a correct existing certified VibeSchool visual, including audience, grade, labels, permissions and intended placement.
2. **Design the visual:** record exact content, educational purpose, labels, caption, alt text, age/ability appropriateness, colour/contrast and where it supports an explanation, model, activity, practice, revision or Teacher Guide.
3. **Produce the actual asset** using appropriate tools when needed. A text brief or a broken image placeholder does not satisfy a visual-dependent learning outcome. Check mathematical/scientific accuracy, labels, readability, rights, cultural sensitivity and mobile legibility.
4. **Register through the existing Visual Learning Library:** current technical contract uses learning_resources with asset_kind=visual_aid and versioned learning_resource_versions, with a private storage object and real curriculum link. Use the approved intake and release process. Do not invent UUIDs, hardcode temporary image URLs or upload an extra copy to each lesson.
5. **Link certified resources** by the canonical reference understood by the reader (e.g. [visual:UUID] **only when that ID and released version actually exist**). Reuse one certified asset across eligible core, supplementary, revision and teacher surfaces.
6. **Verify actual render** in the learner/teacher surface, responsive sizing, alt text/caption, restricted draft access and permitted public certified access.

**Visual evidence states:** VISUAL_PLANNED → ASSET_CREATED_NOT_STORED → PRIVATE_CANDIDATE_STORED → certified/released only by existing authorized process → LEARNER_VISIBLE only after reader proof. Do not upgrade a state without evidence. If an authenticated binary-upload capability is absent, produce the asset/brief as far as possible and report the exact capability boundary; do not require the solo owner to operate HQ or bypass security.

## 7. Exercises and canonical question / exam bank — one assessment authority

- Teaching examples, fully revealed solutions and guided steps are **learning resources**, not protected exam questions by default.
- Each independent reusable question must have a stable source/item ID and version, verified outcome, grade/subject/language, item format, difficulty, cognitive demand, accessibility needs, prompt, answer authority or performance rubric, worked reasoning, points where applicable, realistic distractors, misconceptions, feedback, exposure and eligible context.
- Use existing source/content blocks and the existing assessment bank item model and approved operations; inspect the real current schema and APIs before mapping. Reuse eligible bank questions in **permitted formative** lesson exercises, worksheets, topic practice and quizzes, avoiding duplicate authorities.
- Formal exams are distinct controlled contexts: approved, sufficiently fresh/unseen variants, no copied revealed worked answers, safe answer release, attempt/timing/marking policies and authorization. Do not automatically promote a lesson question into a protected exam because it exists in a chapter.
- Prevent answer leaks to learner-facing payloads and unearned mastery from repeated known questions. Do not silently auto-mark reflection questions without a checked answer or rubric.
- Test real or safe controlled paths for correct, incorrect, skipped, retried, resume/submission where applicable, feedback, teacher preview and protected exam answers. **A Markdown item ledger does not prove bank registration.** Record BANK_LINKED only when a valid actual link is read back and usable.

## 7A. Deep, reusable Question Bank contribution — plentiful but genuinely valuable

VibeSchool needs a **substantial pool of original questions**, not merely the five or ten questions shown in the learner lesson. Generate an intentionally diverse candidate pool per verified outcome so it can supply supplementary exercises, topic practice, revision, quizzes and **separately authorized, genuinely unseen formal exam variants**.

1. Inspect existing question bank items, exposure, versions, duplication and approved eligibility before creating new questions. Keep one canonical bank authority.
2. Draft an outcome-level coverage blueprint first: prerequisite recall, conceptual understanding, routine application, multi-step reasoning, inference/interpretation, real-life transfer and plausible misconception checks as appropriate.
3. **Volume guidance:** For a substantial assessable outcome, aim for **15–25 genuinely distinct candidate items** where meaningful; record a justified smaller or larger target for short, practical, performance-only or particularly broad outcomes. This is a production-planning target **not a forced quota, a certification threshold or an assertion they are already bank-linked**. A smaller set of excellent items beats many clones. Combine outcomes into topic/term/subject pools gradually.
4. Build different question formats as appropriate: well-designed MCQs with plausible distractors, short answers, matching, ordering, fill-in, calculations with written steps, novel word problems, comprehension, editing, structured responses and rubric-scored writing/speaking/practical tasks.
5. For English, use **more than one original stimulus/passsage** as appropriate and cover complete reading passages, grammar in context, language editing, vocabulary, writing with marking criteria and listening/speaking scripts and observation rubrics. Do not treat previously revealed reading passages as unseen exam material.
6. Each candidate needs a clear friendly prompt and complete stimulus, verified answer or marking rubric, worked reasoning as appropriate, marks/partial credit rules where applicable, feedback, hints where permitted, common wrong-answer diagnosis, grade/language/outcome mapping, differentiation/accessibility, and uniqueness/variant review.
7. Maintain separate revealed educational items and protected unseen exam items with actual exposure policy; **never automatically convert a known worked example, practice question, revision solution or teacher demonstration into a secure formal examination item**.
8. Keep bank IDs, internal codes, approval states and protection metadata out of the question screen, image and answer review. Use ordinary “Question 1”, “Choose the best answer”, “Show your working” and “Explain your answer”.
9. Validate answers, item variation, actual stored ID/version, bank eligibility, legal safety and the existing approval workflow. A generated manuscript is **not** a bank registration.
10. Report the distinct counts: **candidates drafted / fact-and-answer checked / reviewed / actually bank-linked / eligible for protected exams**. Never use a raw count as proof of educational value or live availability.

**Exam-building requirement:** draw from a verified blueprint covering the correct outcomes, mark balance, cognitive demand, time suitability and genuinely fresh protected variants. Existing formal-exam review, authorization and answer-security policies always win.

## 8. Canonical integration — no parallel products

Use the existing relationships, inspecting current implementations rather than treating a diagram as an executable schema:

**Official KICD source → verified VibeSchool Curriculum Map / outcome IDs → canonical Content Engine publication/chapter and content/resource versions → Scheme of Work / relevant lesson selection → teacher notes, guide, visual and teaching links + learner VibeLearn reader → eligible supplementary/revision/topic-practice/question-bank consumers → real learner answers and progress evidence.**

- **Curriculum is what is taught. Scheme is when it is intended to be taught. Lesson Plan and teacher tools are how.** Content is authored independently of timetable. A scheduled lesson must use its actual timetable occurrence context.
- **One canonical authoring source:** derive or reference learner and teacher experiences from the same outcome/version; do not hardcode a separate book/page for each tool. A worksheet or revision set may package several existing IDs without duplicating question authority.
- **One stable identity per authoritative resource/version** with correct cross-surface references. Repair wrong grade, incorrect sub-strand or detached scheme/source links at the canonical layer, not with a title match.
- **One learner evidence trail** from actual attempts/observations; records must be correctly scoped and protected by existing identity, tenant and access controls.
- **Safe visibility:** published learner content, teacher-private materials, draft visuals, protected exam answers and unpublished candidates have different permissions; preserve these boundaries.
- Mark links and capabilities **NOT_CONNECTED**, **NOT_CHECKED** or an actual verified working state. Never claim a proposed automatic recovery route is functioning until its real reader/assessment/teaching path is tested.

## 9. The production loop — use this for EVERY requested subject

| Phase | Chat must do | Evidence required before next phase |
| --- | --- | --- |
| **A. Scope & source** | Resolve grade/subject/version and source of truth; inventory requested outcomes | Official source reference, exact scope ledger |
| **B. Reconcile** | Compare current KICD with real VibeSchool canonical outcomes; repair mismatch first | Every included requirement MATCH; if not, BLOCKED_CURRICULUM_RECONCILIATION |
| **C. Library reuse** | Inspect content, Teaching Library, Visual Learning Library, question bank, prior revision and versions | Existing IDs reused, defects identified, or NOT_CHECKED where inaccessible |
| **D. One-outcome authoring** | In ONE pass create Core + Supplementary + Revision readiness + Teacher Support | All relevant components substantive and educationally selected |
| **E. Accuracy and pedagogy** | Verify worked reasoning, facts, answers, rubrics, age/ability, media, safety, originality, misconception response and usefulness | Defects corrected; no invented checks or substitute placeholders |
| **F. Canonical identity** | Record actual source IDs, resource versions, item uses, eligibility and visual/teaching links | Actual readback, or candid NOT_CONNECTED / ASSET_CREATED_NOT_STORED |
| **G. Real consumers** | When tools permit, test teacher lesson/note/guide, independent reader, exercises, topic revision, feedback, secure bank and relevant device/access states | Current route-level evidence, not just successful file creation |
| **H. Outcome closed** | Record scope, status, evidence, material defects and any specific blockers | Outcome package accepted for the proven scope only; then next outcome |
| **I. Synthesis** | At topic, term and subject boundaries assemble accurate mixed revision and teacher support from completed outcomes | All contributing outcome IDs and source coverage verified |
| **J. Release & learn** | Use existing authority and quality/release gates; verify version and real visibility; record feedback/repair | Released/published/learner-visible only if independently evidenced |

**Recovery loop:** FIND gap → diagnose earliest canonical cause → repair → reverify dependent content or IDs → resume the original outcome and remaining requested scope. Do not silently skip a failed visual, question answer, required curricular outcome or broken resource reader. Avoid needless owner questions: the owner chooses the grade/subject, not each example, image or item. Escalate only a genuine missing capability, consequential rights/safety issue or existing authorization boundary.

## 9A. Extra content-quality and presentation acceptance tests

Use the **existing** content quality/evidence mechanisms. These are editorial review expectations, not new runtime enums or a claim that automation already exists.

| What is checked | Acceptance evidence | If weak or absent |
| --- | --- | --- |
| Teacher Lesson Notes | Actual structured sections, board model, prompts **with expected answers**, misconception remedies, short assessment and usable materials | Repair before claiming notes complete |
| English aids | Complete original passage/script/word or writing aid as relevant, exercises and correct answers/rubrics | Repair English content |
| Supplementary | Useful graduated exercises, correct stimuli, answers, hints, accessibility and real practice scope | Repair practice |
| Revision | Fresh retrieval, mixed application and correct response → targeted help → fresh check path | Repair revision / mark NOT_CONNECTED |
| Question-bank contribution | Blueprint, justified candidate target, item diversity, actual answer checks and distinct drafted/reviewed/bank-linked/eligible counts | Report incomplete pool; do not invent bank links |
| Diagrams | Actual registered suitable aid where required; correct clear labels, caption, alt text and actual display check | Repair asset / mark not delivered |
| Friendly presentation | No internal curriculum codes, source attribution jargon, dev terms, placeholder tokens or raw IDs anywhere in actual instructional/print/visual/accessibility surfaces | Record and repair display defect |
| Formal exam safety | Protected answer access, original unseen variants, approved scoring and authorization | Block affected exam release |

**A documentation change cannot silently install a display filter, register a real question bank item, produce an image or publish content.** Verify the real systems separately and report exact states.

## 10. Stop rules and quality acceptance — the product is the teaching

**Never call an outcome complete merely because all fields contain text.** For each outcome require, as applicable:

- **Alignment:** reconciled KICD source and canonical VibeSchool outcome identity, no hidden missing outcome or false source edition.
- **Subject correctness:** full and correct explanations, worked calculations, symbols, formula conditions, units, labelled visuals and answer/rubric authority.
- **Pedagogical excellence:** learner understands rather than memorizes; clear structure; age/ability-sensitive supports; meaningful modelling, exploration, guided practice and independent transfer; no repetitive filler or invented reference.
- **Teacher usefulness:** actual prompts, pacing, material options, instruction, marking/observation and error correction; no dependency on the teacher reconstructing missing lessons.
- **Three experiences together:** core genuinely teaches; supplementary targets practice; revision checks appropriate retention/transfer with planned return-to-learning; deliberate NOT_APPLICABLE is recorded only when instructionally valid.
- **Resource quality:** real useful visuals where required; actual library reuse/creation and IDs; checked rights, alt text, certified versions and reasonable mobile visibility.
- **Assessment integrity:** checked answers and error feedback; stable bank lineage; protected formal exam variants and correct role/permission.
- **Connection evidence:** genuine IDs, correct Scheme/resource/reader links and tested relevant user journeys; absence honestly stated, not “fixed” by manuscript prose.
- **Evidence-based impact:** an observed learner explanation, performance, correct application or teacher evaluation is needed to claim learning improvement/teacher time saved. Generated copy and volume alone cannot support those claims.
- **Publication honesty:** content drafted ≠ checked ≠ independently quality-assured ≠ authorized ≠ published ≠ learner-visible.

**No arbitrary scores or 100/100 certification by author self-review.** Fix problems within authorized scope and report independent verification gaps where release policy requires it. Unavailable/inapplicable content types are never a reason to pad a lesson with irrelevant media or activities.

## 11. One outcome record — required compact handoff, no extra owner form

Use one record per outcome. The chat assembles it as part of the actual work; it is not a questionnaire to the user.

| Field | What to capture |
| --- | --- |
| **Identity** | Grade, subject, term/scope, KICD design edition/source pages, VibeSchool outcome/strand/sub-strand ID, reconciliation PASS evidence |
| **Core** | Canonical lesson/chapter ID and version, complete explanation/demonstration/visuals, checked worked example, learner check |
| **Supplementary** | Activity/worksheet/practice IDs and purpose, support/core/extension, answers or rubrics and error feedback |
| **Revision** | Retrieval/application and mixed-question IDs, when appropriate, linked core/reteach/fresh-check references, learner-specific NOT_YET_TAUGHT where relevant |
| **Teacher** | Guide/notes, prompts, teaching resources, anticipated mistakes, preparation, observation criteria, actual Scheme/lesson links |
| **Library** | Existing assets reused, new assets created, real visual and teaching resource IDs/versions, optional teaching slots, exact visibility |
| **Assessment** | Existing or new question IDs, verified outcome mappings, exposure, answer authority, eligible contexts, protected exam variants |
| **QA** | Fact and answer checks, age/accessibility checks, visual integrity, safety/originality/rights, defect repair and independent checks if required |
| **Human workability** | Relevant intended audiences and roles, actual learner/teacher/home-support/assessor usability where applicable, prerequisite bridge, language, accessibility, phone/low-resource adaptations and tested route or NOT_CHECKED |
| **Economics and impact** | Measured or NOT_MEASURED outcome cost, draft-to-usable/release time, required/reconciled/completed outcome counts, question-bank yield, reuse, rework, representative user-task success and real learning evidence |
| **Status/evidence** | What was authored, stored, bank-linked, quality-reviewed, release-authorized, published and actually learner/teacher-visible; explicit missing pieces and links |

**At topic completion:** mix only its verified outcomes into integrated application and revision; record existing refs. **At term completion:** add a real term-scope summary, varied retrieval and teacher revision guidance. **At full-subject completion:** verify every strand, sub-strand and learning outcome in the declared official scope plus cumulative revision and real route/link status.

## 12. Precise status words — never substitute aspiration for evidence

| Status | Meaning / minimum evidence |
| --- | --- |
| SCOPE_IDENTIFIED | Grade/subject, source candidate and target boundaries stated |
| BLOCKED_CURRICULUM_RECONCILIATION | Official/canonical comparison incomplete or mismatched; no new content for that unresolved scope |
| CURRICULUM_MATCH | Official and canonical outcome-by-outcome comparison has actual recorded PASS |
| MANUSCRIPT_DRAFTED | Learner/teacher text or asset brief is written; no storage or quality claim |
| CONTENT_COMPLETE | All applicable outcome components exist with checked instructional/answer substance and reasoned omissions; not a publication claim |
| SELF_CHECKED | Author checked specified facts/work; **not independent assurance** |
| QUALITY_REVIEWED | Existing required quality/reviewer gates have real results, scoped to exact version |
| VISUAL_PLANNED / ASSET_CREATED_NOT_STORED | Real visual brief / actual generated image not yet confirmed in canonical storage |
| PRIVATE_CANDIDATE_STORED | Authorized canonical private asset and candidate version read back; not public |
| BANK_LINKED | Existing assessment/question-bank ID, eligibility and reuse or source link verified through canonical authority |
| NOT_CONNECTED / NOT_CHECKED | Expected link or user journey absent / access to its evidence unavailable |
| NOT_YET_TAUGHT | Learner-specific study/retention is not evidenced, even if revision content has been authored |
| RELEASE_AUTHORIZED | Actual current authorized release decision for the exact version |
| PUBLISHED | Canonical publication state verified; not necessarily accessible on all surfaces |
| LEARNER_VISIBLE / TEACHER_VISIBLE | Real applicable user can open/render the correct released version and interact as intended |

**Status combinations:** A package can be MANUSCRIPT_DRAFTED with VISUAL_PLANNED and NOT_CONNECTED. It can be CONTENT_COMPLETE without being PUBLISHED. A GitHub merged Markdown policy, a proposed schema link, a teacher-library slot or a saved PDF does not by itself establish live educational content.

## 13. Example of one pass — Grade 4 Mathematics: hours and minutes

**Illustrative pedagogy only:** first verify the applicable KICD outcome, exact curriculum scope and VibeSchool record; this paragraph is NOT itself proof of official outcome wording, topic allocation or live content.

- **Core:** Explain 1 hour = 60 minutes with clock or clear minute-group visual; model 3 hours = 3 × 60 = 180 minutes and explain why multiplication represents three groups of sixty. Check with inverse reasoning.
- **Supplementary:** Give supported conversion of 2 hours, independent conversion of 5 hours, a short applicable context problem and an appropriate extension. Give checked answers, reasoning, a physical or drawn 60-minute scaffold and misconception-specific feedback.
- **Revision readiness:** Draft a fresh conversion/application prompt, independent retrieval check, explained answer and exact link back to the hours/minutes lesson and suitable targeted practice. Later mix with elapsed-time outcomes **only if those outcomes are verified and genuinely in the revision scope**.
- **Teacher:** Prepare concise teacher Lesson Notes (key fact, board model, questions, expected answers, misconceptions/remedies and checks), alongside the fuller Teacher Guide, clock model, differentiation and verified resource references. Keep notes linked to the same verified outcome as learner Core (see §4.5).
- **Assets and bank:** Reuse a suitable certified clock visual or create and register a new asset through the existing library. Identify practice item IDs and eligibility; do not make a revealed lesson solution a protected exam question.
- **Finish:** Record curriculum PASS, manuscript/asset actual state, correct IDs and real reader/assessment evidence. Fix missing essential components before advancing to the next outcome.

## 14. Single instruction for the next ChatGPT content-generation chat

**Use this instruction verbatim or simply name the grade and subject while this playbook is available in the repository:**

> Produce complete VibeSchool-original educational content for [GRADE] [SUBJECT] across [DECLARED SCOPE]. Follow docs/curriculum/CONTENT_GENERATION.md as the single mandatory workflow. Where private source transcription is needed and authorized, also follow docs/curriculum/COPY_KICD_CURRICULUM.md: preserve the KICD reference word for word, verify every page and field against source and persisted readback, and never expose source text in learner/teacher materials. First read the applicable official KICD curriculum and the *actual current* VibeSchool curriculum; compare every required outcome, repair mismatches canonically and proceed only after reconciliation PASS for the stated scope. For each outcome, inspect/reuse existing content, teaching resources, visuals and question-bank items; in the same pass produce Core Learning, appropriate Supplementary Practice, Revision readiness/content and Teacher Support. Explain worked methods, create real necessary visuals, provide checked answers/rubrics, age/ability adaptations and error feedback. Record stable IDs, versions and reuse permissions, distinguish exposed practice from protected exams, and assemble topic/term/subject revision incrementally. For every intended human role, check practical understanding, teachability, accessibility and home/independent workability where relevant; include realistic low-resource/mobile support without claiming untested offline functionality. Record full production cost and time, coverage, question-bank quality yield, reuse, corrections and observed learning benefit only when measured (otherwise NOT_MEASURED). Run the relevant quality and real user-journey checks; repair defects; preserve existing security/release controls and honestly report any NOT_CONNECTED or BLOCKED state. Do not stop after an outline or falsely claim publication. Continue sequentially through the requested scope without routine owner approvals.

**Final release report:** matched N/N required outcomes; outcome packages authored/check states; reused/new library assets and verified IDs; optional teaching resources selected; question/exam-bank eligibility and connection; topic/term/subject revision coverage; teacher and independent reader results; selected human-role workability checks and accessibility constraints; full-cost/time and effectiveness metrics actually measured or explicitly NOT_MEASURED; actual release/visibility status; open defects and exact blockers/next authorized actions.

---

**Presentation law:** Teachers and learners see educational lesson titles, understandable diagrams, complete notes, useful aids, worked examples, practice, revision and ordinary question numbers — not codes, source-authority names or development terminology. Keep verification and internal identities private and intact.

**Canonical content production law:** **One curriculum truth. One content source. One outcome package. Three integrated learning experiences. One teacher-supported learning journey. One approved assessment authority. Evidence before quality, integration or publication claims.**
