# VibeSchool Originals — Single Canonical Content Generation Playbook

**Version:** 1.0 — 12 November 2026
**Owner-approved educational direction:** Top-class, VibeSchool-original, KICD-aligned learning that demonstrates learner understanding and genuinely helps teachers teach.
**Applies to:** ChatGPT-led generation and material revision for Grades 1–9, all subjects, outcomes, terms, teacher resources, learner materials, exercises and revision. Other grades require their own applicable official curriculum authority.
**Role:** ONE required start-here operating document for all VibeSchool educational content-generation chats. Use it in full. Do not choose competing instructions from several independent checklists.
**Nature:** Editorial/production policy only. It does not change application code, database permissions, content-engine publication, runtime/worker authority or certification requirements.

> **Governing rule: Verify KICD against the actual VibeSchool curriculum → repair discrepancies → inspect and reuse canonical libraries → author Core + Supplementary + Revision + Teacher Support together for each outcome → verify answers, media and pedagogy → save and link using existing identities → check actual delivery → advance to the next outcome. The learning product is understanding, not the quantity of content.**

## 0. One entry point, existing specialist contracts

**Start every content-generation request here.** This document unifies the approved **educational work order and acceptance gates**, rather than replacing technical source-of-truth contracts or GitHub engineering governance.

- **This playbook:** authoritative sequence, content package, cross-library handoff, evidence/status and educational completion criteria for all content-generation chats.
- [Content Production Standard](./CONTENT_PRODUCTION_STANDARD.md): deeper pedagogical examples, subject-specific accuracy and assessment criteria. Use as supporting educational detail, not a different work sequence.
- [Content Operating Model](./CONTENT_OPERATING_MODEL.md): ChatGPT-led staffing and practical execution/handoffs, subordinate to this playbook's single content-generation loop.
- [Content Package Template](./CONTENT_PACKAGE_TEMPLATE.md): optional detailed recording format for the **same** outcome package and coverage ledger; not another parallel approval system.
- [Visual Learning Library](./VISUAL_LEARNING_LIBRARY.md): **technical authority** on canonical visual resource identity, version, storage, approved asset lifecycle, and certified-only image rendering.
- [Teaching Library Linkage](./TEACHING_LIBRARY_LINKAGE.md) and lib/teaching/libraryStructure.ts: **technical authority** on the 15 optional teaching-resource slots, resource-kind metadata, scheme links, certification and actual teacher discoverability.
- lib/assessment/questionBank.ts, canonical assessment definitions/items and their current database contracts: **technical authority** on existing bank promotion, reuse, answer access and formal examination rules.
- Root AGENTS.md, Cyborg executor and control-plane policy: **higher-priority authority for repository mutation, PRs, CI, security, release, independent assurance and production changes**. Educational authoring is ChatGPT-led; code or database writes still follow engineering governance.

**Conflict rule:** Official curriculum and factual evidence govern learning scope; current verified canonical repository/database contracts govern identity and integration; applicable legal/rights/safety/release rules always apply. Within *content-generation workflow* use this one playbook; if a supporting document diverges, record the contradiction and update the related documentation rather than silently choosing the easier version. Do not rewrite or weaken a technical, security or release contract from editorial prose. Keep the supporting files for detailed specifications; no one must search several files just to learn the normal production sequence.

## 1. The non-negotiable mission

1. A learner must be able to **understand, explain, demonstrate, apply and progressively retain** the relevant outcome, at an appropriate level of support.
2. A teacher must be able to **prepare, explain, model, manage activities, check understanding and intervene** using real, ready-to-use support.
3. All material must be **correct, original, age- and ability-sensitive, inclusive, accessible, purposeful, culturally relevant where helpful, and appropriately safe**.
4. Curriculum fidelity must be **provable, outcome-by-outcome**, rather than a heading or marketing claim.
5. A page count, an exercise count, a bank item count, views, a generated file, a GitHub merge and a learner's unverified clicks are **not** proofs of understanding, teacher effectiveness or live publication.

**No textbook cloning:** Use KICD's authorized curricular scope as the alignment authority. Write VibeSchool-original explanations, examples, activities, graphics, instructions, questions, feedback and teacher guides; do not reproduce publisher content or whole official curriculum passages. Do not claim formal KICD approval unless independently established.

## 2. Mandatory gate ZERO — KICD ⇄ VibeSchool curriculum reconciliation

**STOP CONTENT WRITING until this gate passes for the exact intended scope.**

1. **Identify scope:** grade, subject, applicable curriculum/system, source design title and edition/date, language, term/strand/sub-strand/outcomes, official lesson-allocation guidance if present. If the owner names a whole subject, inventory the whole subject; if one topic, keep the boundary explicit.
2. **Read the actual official source:** locate and inspect the applicable authoritative KICD design, record URL/document, revision and exact pages or sections with access date. Do not infer outcomes from an index, a remembered design or a secondary book.
3. **Read actual VibeSchool curriculum:** inspect the canonical curriculum map and current persisted outcome records, not a prior chat claim or an isolated Markdown file. Read existing scheme/outcome references affected by changes. Keep teacher-owned Scheme of Work and timetable records separate from official curriculum authority.
4. **Compare line by line:** source strands, sub-strands, outcome meanings and scope, specific learning experiences and inquiry, competencies, values, applicable contemporary issues, assessment expectations, progression, suggested lessons and relevant differentiation. VibeSchool wording can be original but must preserve required intent and scope; do not invent lesson allocations.
5. **Record a reconciliation ledger:** source locator → stable VibeSchool outcome ID → MATCH / MISSING / PARTIAL / EXTRA / CONFLICT / NOT_CHECKED → required correction and evidence.
6. **Repair the canonical curriculum first:** resolve every MISSING, PARTIAL, EXTRA or CONFLICT affecting the intended scope through the existing authorized source-of-truth/migration process. Preserve stable IDs, school-owned schemes, historic evidence and unrelated records. Recheck the corrected canonical map, scheme links and affected consumers.
7. **Pass only with evidence:** every required source outcome in the declared content scope must be MATCH, with source and VibeSchool refs actually inspected. If source, data or authority cannot be accessed, report BLOCKED_CURRICULUM_RECONCILIATION for that scope; investigate normal mismatches without asking the solo owner to do routine checking. A separately reconciled smaller scope may proceed **only** with its explicitly narrower claim.

**Mandatory gate declaration:** “KICD ↔ VibeSchool: [grade/subject/scope], [official edition and pages], [matched N of N], [repairs and canonical IDs], PASS or BLOCKED.” Never write PASS from inference. **A curriculum PASS is not content quality approval or publication.**

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
- Prepare support/core/extension pathways based on actual learner prerequisites and needs, without hard-coding stereotypes by age, grade or a single wrong response.
- Produce practical teacher notes and guidance from **the same source**: purpose, prior knowledge, prompts, preparation, materials, classroom management, realistic timing, board/visual guidance, sample responses, differentiation, safety and observation/marking rules.

**Core acceptance:** a learner can encounter a complete explanation or equivalent accessible experience; a teacher can deliver it with the included guidance. A short paragraph plus ten questions is NOT a finished lesson.

### 4.2 Supplementary Practice — equivalent to a purposeful activity book

- Target the precise verified outcome or prerequisite, specify educational purpose: guided, independent, reinforcement, remedial, enrichment, project, worksheet, home activity or performance.
- Prefer activities that strengthen the skill: concrete objects, diagrams, discussion, writing, oral practice, calculations, investigations, games or practical demonstration. Do not default to MCQs for every subject.
- Sequence from accessible support toward independent application, then appropriate challenge. Select a **meaningful** number of questions, not a fixed artificial quota.
- Record correct answers with reasoning, sample responses/rubrics, error-specific feedback, retry hints and the teacher's next intervention; validate answers independently where feasible.
- Include short, clear home-use directions and low-cost/safe alternatives if suitable. Treat activities and exercises as useful instructional experiences, not mandatory separate apps.
- Preserve a stable activity/question source ID, version, outcome mapping, difficulty/cognitive demand, visibility/exposure and eligible reuse (lesson, worksheet, homework, topic practice, quiz or other permitted context).

**Practice acceptance:** it reveals or improves the target skill with constructive feedback. Mere repetition of the teaching example or a large question volume is inadequate.

### 4.3 Revision and Consolidation — equivalent to a revision book

- Draft revision **readiness** for the same verified outcome in the same pass: a concise accurate reminder, retrieval prompts BEFORE displaying explanations, a fresh or varied application/transfer question, correct answer or rubric, and a diagnostic next step.
- Distinguish **drafted for later revision** from **a specific learner has studied it**; never credit learner mastery or completion without real evidence. Revision can be voluntarily available according to access policy.
- Map each wrong or skipped response to an exact misconception/outcome, the core explanation or worked model, a suitable supplementary remedial activity, and a **fresh reassessment item**. Where actual UI routing is not verified, document the intended IDs and mark NOT_CONNECTED.
- At topic completion, assemble mixed and cumulative retrieval/application across the **verified included outcomes**. At term and declared-subject completion, assemble appropriate broader review, spaced/mixed practice and assessment blueprint with teacher revision guidance.
- Do not use historical KCPE material as if it were the current Grades 1–9 assessment authority. Do not copy restricted papers or leaked formal-exam items.

**Revision acceptance:** the learner can retrieve/apply what was taught and find the exact material needed for improvement, not just see a score.

### 4.4 Teacher Support — prepared in the same pass

Provide the actual aids selected for the outcome: lesson notes, Teacher Guide, demonstration instructions, examples, visuals, discussions, assessments/observation, worksheets and assignments, differentiation, remedies and extension, with true outcome/resource IDs. Do not make every Teaching Library slot compulsory. Do not require a timetable for independent content, a scheme or unscheduled lesson preparation; a dated scheduled occurrence remains relevant to actual scheduled teaching/attendance.

**Teacher acceptance:** teachers can see, understand and use the applicable materials without rebuilding the lesson and without links to the wrong class, week, subject or outcome.

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
- **Teacher:** Prepare a lesson-board or clock model, instructions for questioning, common error (confusing hours/minutes), quick feedback, differentiation and verified resource references.
- **Assets and bank:** Reuse a suitable certified clock visual or create and register a new asset through the existing library. Identify practice item IDs and eligibility; do not make a revealed lesson solution a protected exam question.
- **Finish:** Record curriculum PASS, manuscript/asset actual state, correct IDs and real reader/assessment evidence. Fix missing essential components before advancing to the next outcome.

## 14. Single instruction for the next ChatGPT content-generation chat

**Use this instruction verbatim or simply name the grade and subject while this playbook is available in the repository:**

> Produce complete VibeSchool-original educational content for [GRADE] [SUBJECT] across [DECLARED SCOPE]. Follow docs/curriculum/CONTENT_GENERATION.md as the single mandatory workflow. First read the applicable official KICD curriculum and the *actual current* VibeSchool curriculum; compare every required outcome, repair mismatches canonically and proceed only after reconciliation PASS for the stated scope. For each outcome, inspect/reuse existing content, teaching resources, visuals and question-bank items; in the same pass produce Core Learning, appropriate Supplementary Practice, Revision readiness/content and Teacher Support. Explain worked methods, create real necessary visuals, provide checked answers/rubrics, age/ability adaptations and error feedback. Record stable IDs, versions and reuse permissions, distinguish exposed practice from protected exams, and assemble topic/term/subject revision incrementally. Run the relevant quality and real user-journey checks; repair defects; preserve existing security/release controls and honestly report any NOT_CONNECTED or BLOCKED state. Do not stop after an outline or falsely claim publication. Continue sequentially through the requested scope without routine owner approvals.

**Final release report:** matched N/N required outcomes; outcome packages authored/check states; reused/new library assets and verified IDs; optional teaching resources selected; question/exam-bank eligibility and connection; topic/term/subject revision coverage; teacher and independent reader results; actual release/visibility status; open defects and the exact blockers/next authorized actions.

---

**Canonical content production law:** **One curriculum truth. One content source. One outcome package. Three integrated learning experiences. One teacher-supported learning journey. One approved assessment authority. Evidence before quality, integration or publication claims.**
