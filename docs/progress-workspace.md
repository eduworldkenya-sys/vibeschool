# Student Progress Record: connected Teacher OS design

Research and repository review: 3 October 2026. Inspected main: `622b2b4889f4c33b366919f5a4bad80b5ebee755`. This is a product and implementation contract, not a production-readiness certificate. Competitor descriptions below are documented capabilities, not hands-on usability measurements or an exhaustive ranking.

## Decision

Use **Student Progress Record** as the teacher-facing name. Make it the canonical learner-progress workspace. Preserve lesson reflection as **Lesson progress & next steps**, a related teaching record with its own occurrence identity. Curriculum coverage, a teacher's completion of teaching, learner mastery, and attendance are different facts; do not turn one into another.

The product promise is: **See what each learner can do, understand the evidence, take the next useful action, and check whether it worked—without entering the same result twice.**

## Leading-platform comparison

| Reference | Documented strength | Adopt in VibeSchool | Adapt for Kenyan teachers |
| --- | --- | --- | --- |
| Instructure Mastery Connect | Student/standard and assessment tracker views; standards-aligned assessment; Canvas tracker integration | Outcome matrix with assessment drill-down; support action attached to the exact outcome | KICD outcome IDs and curriculum versions; clear Kenyan performance descriptors; small-screen learner cards alongside the sheet |
| Renaissance eduCLIMBER / MTSS | Combined data, intervention tracking and progress monitoring; continue, change or fade support based on evidence | Baseline, goal, intervention, review date, reassessment and effectiveness check | A short support plan a subject teacher can maintain; richer team coordination only when needed |
| Edsby | A single learner view, teacher evidence/gradebook analysis and data from multiple sources | Learner evidence timeline; class-to-learner drill-down; lineage across recorded learning | Treat absence and missing work as context; never infer a learner's ability or personal circumstances from them |
| ManageBac+ | Standards assessment in term gradebooks, report-card workflow and configurable assessment models | Term-based record, explicit grading policy, draft/review/release reporting | Familiar printable school records and parent-friendly language; separate legacy KCSE marks from CBE levels |
| 1EdTech OneRoster and CASE | Roster/grade exchange and digitally referencable competency frameworks | Stable external IDs, exchange adapters, versioned curriculum mappings | Start with validated CSV/XLSX; add standards adapters after canonical data works. Do not claim certification or universal integrations |

Primary sources checked:

- https://community.instructure.com/en/kb/articles/661998-how-do-i-view-a-tracker
- https://community.instructure.com/en/kb/mastery-connect-canvas-mastery-guide
- https://www.renaissance.com/solutions/supporting-mtss-whole-child/
- https://www.edsby.com/k12-student-analytics/
- https://help.managebac.com/hc/en-us/articles/26280687775257-Standards-based-Grading-in-Term-Grades-pages-of-Gradebook
- https://help.managebac.com/hc/en-us/articles/360045275492-Multi-Curricula-Non-IB-Reports-Editing-Report-Card-Templates-Publishing
- https://www.1edtech.org/standards/oneroster
- https://www.1edtech.org/standards/case/about
- https://knec.ac.ke/wp-content/uploads/2020/08/REPORT-ON-THE-2019-MONITORING-OF-LEARNERS%E2%80%99-PROGRESS-GRADE-3.pdf

The KNEC report establishes use of expectation descriptors in the described assessment. It does not establish a universal percentage conversion for every Kenyan grade, curriculum or task. VibeSchool must verify current task/school/curriculum grading authority before presenting a calculated level as official.

## Current VibeSchool findings

| Existing component | Verified repository behavior | Reconciliation needed |
| --- | --- | --- |
| `/teacher/progress` | Completed occurrence-bound teacher reflection with exact plan/homework prefill | Keep occurrence links working; add learner-progress entry without substituting reflection for learner results |
| Class progress | Reads enrollment and evidence; filters current/archived learners | Uses nested learner joins and truncated evidence; averages across subjects; latest single proficiency can label an entire learner |
| Individual progress | Outcome records, evidence history, search and print | `This term` is a rolling 120 days; outcome grouping omits subject/learner identity; two scores can produce trend claims; generic 80/60/40 score conversion differs from existing assessment evidence mapping |
| Class Workbook | Existing sheets, imports, bulk entry, exports, groups, optimistic revision protection | Reuse it; do not build a second spreadsheet or copy academic marks into workbook cells. Deep links must select the intended sheet |
| Intervention queue | Existing remedial assessment and released follow-up evaluation; manual completion refused | Listing refreshes data. Separate read from refresh; preserve goals/baselines/due dates; prove current membership and subject scope on every operation |
| Learner intelligence | A comparable released-assessment trend already requires four assessments | Progress views must share comparable-evidence rules and explain their selected comparison |
| Canonical Twin | Role-authorized deterministic search, workflow answers and confirmed marks actions | Route progress queries to the same projection; never substitute a broad snapshot answer for outcome/learner evidence |
| PR #710 | Open, unmerged, not mergeable at inspection; proposes canonical current/historical roster authority | Reconcile and test its roster contract before certifying historical learner progress. Do not silently invent a second roster authority |

Production database parity, signed-in mobile journeys, every source's release propagation and reporting permissions were not proven by source inspection. These remain release gates.

## Usability: one workspace, progressive detail

Entry: **Progress Record**. Context bar: school → class → subject → year/term. Make the active context visible on every report/action. Remember view preferences, but revalidate permissions; an old preference cannot authorize a school or class.

Views:

1. **Class overview**: current roster, a short needs-attention list, assessed/unassessed outcomes and recent changes. Each count opens the exact learners/evidence behind it.
2. **Record sheet**: existing Class Workbook, with learner rows and assessment/outcome columns. Frozen identity column, keyboard navigation, paste preview, undo for drafts and clear saved/pending states. Academic edits use the existing domain authority, not custom cells.
3. **Learner record**: current evidence, strengths, support needs, changes, previous actions and next review. Open source evidence without losing filters.
4. **Support**: the existing intervention lifecycle, filtered to the same class/subject/learner/outcome. Include enrichment; a high-performing learner is not a problem alert.
5. **Reports**: class, learner, subject and term projections, then draft/review/release for family or school distribution.
6. **Data checks**: source coverage, incomplete outcome mappings, missing releases, roster identity failures and conflicts. Use human messages such as “3 marked quizzes have not been released yet,” with the right recovery action.

On Android, show learner cards first; provide an explicitly horizontally scrollable sheet. Keep actions at least 44 pixels high, labels readable, errors actionable and status distinguishable without colour. Avoid a permanent wall of dashboard cards. A teacher should reach a support action in three deliberate selections after opening the class.

## Canonical evidence and reconciliation

Reuse these authorities: `students.id` for identity, `student_classes` for enrollment, live `school_members` and `teacher_classes` for permissions, occurrence/lesson/scheme identities for teaching, existing assessment/exam/homework stores for scores, `competency_evidence_ledger` for outcome-linked evidence, existing intervention records for support, and the workbook for projections/private custom values.

A projection is a query of those authorities, not another gradebook. It must carry source type, source ID, school/class/subject/learner, outcome/curriculum version where applicable, event time, mark maximum, grading policy, release/moderation state and author. Existing schema fields must be inventoried before adding missing ones.

Rules:

- Deduplicate by source identity and outcome, not by matching names, row positions or equal scores.
- An assessment total and its outcome responses are two views of the same assessment; do not count them twice as independent proof of learning.
- No outcome link means “Assessment recorded; outcome not linked,” not an invented curriculum mapping.
- Zero is a valid score. Missing, absent, exempt, provisional and unmarked are separate states.
- Whole-subject CAT/exam totals cannot prove mastery of a particular outcome without an item/outcome mapping.
- Marks and competency descriptors retain their own scales. No universal percentage-to-CBE conversion.
- A teacher may inspect authorized provisional evidence in a clearly identified workflow; parent/released reports must use released authority. Reversed/corrected marks invalidate dependent insights and report drafts.
- Current and transferred learners use canonical enrollment history. Historic visibility must not broaden global learner RLS. Missing readable identity is an error with recovery, never silent roster shrinkage.
- Reading the workspace must not create support records, reset due dates or change marks. Refresh/recompute is an explicit authorized action.
- Imports stage and validate identity, scope, units and duplicates; preview before commit; preserve request identity for safe retries; verify saved results.
- Use actual school term boundaries and Nairobi dates. Between terms, show that no term contains today and allow an explicit historical selection.
- Query pages in a deterministic order. If a bounded load cannot establish completeness, fail visibly instead of issuing class-wide claims from a hidden subset.

A reconciliation drawer should show “Saved in the source,” “Linked to outcome,” “Released,” “Included in this view” and “Last refreshed.” Show the reason when any step fails. Avoid promising live synchronization without a measured freshness contract.

## Intelligence that can explain itself

Each insight has a reason, applicable context, evidence IDs, count, observation dates, calculation version and limits. “Needs support” is a curriculum-specific action state, not a permanent learner label.

- **Improving/declining/stable:** compare at least four independent observations in the same learner, subject, outcome and assessment family; compare the two recent with the two previous. Disclose a five-point change threshold as an application rule, not an official grade rule. No cross-subject or mixed quiz/exam comparisons.
- **Strong/support outcomes:** use the recorded rubric judgement or an explicitly configured policy. Retain the numeric score independently. Contradictory recent evidence prompts review.
- **Missing recent evidence:** selected period and expected/taught outcomes govern the flag. Never call a learner weak because there is no score.
- **Class gaps:** show a denominator of enrolled learners plus assessed/not assessed counts. Twelve struggling learners out of twelve assessed is different from twelve out of thirty-eight enrolled.
- **Context:** attendance, incomplete work and teacher observations may help discussion; do not claim they caused the result or infer health, disability, family circumstances or motivation.
- **Prediction:** separate forecast from observation. Start with scheduled-work forecasts; introduce learner-performance forecasts only with validation, calibration and false-alert monitoring. Show “insufficient evidence” when needed.
- **Alerts:** one bounded digest; combine duplicate learner/outcome alerts, show the reason, allow review/snooze and resolve only when the underlying condition changes. Measure false positives and overdue reviews.

The UI should answer “What evidence is available?”, “What changed?”, “What have we tried?” and “What needs checking next?”. “Why did this happen?” remains a teacher hypothesis supported by context, never a fabricated diagnosis.

## Close the intervention loop

`Identify outcome → review evidence → record baseline + measurable goal → choose activity/group → assign → record delivery → reassess → release result → compare → continue/change/close → report`

Preserve the original baseline, action, target learners, target outcome, goal, review date and source IDs. A retry must not duplicate an assignment. A refresh must not postpone an overdue review. Creating an assessment draft is not assigning it; assigning is not completing it; an improved score is not causal proof that the intervention worked.

Reuse existing remedial-builder and evaluation authorities. Require released, outcome-linked follow-up evidence; prevent closure by note alone. Retain completed support history and permit a new episode without erasing the previous one. A teacher should be able to see unsuccessful support and choose a different method.

## Connected teacher actions and Twin

Every action carries exact school/class/subject/learner/outcome/term context, revalidates authority at execution, previews affected learners, and returns a saved/read-back receipt. Provide observation, remark, homework, remedial assessment, enrichment, group, reassessment, learner drill-down and report preparation through the existing owning workflow.

Twin must use the same structured query/projection contract as the UI:

| Teacher request | Deterministic behavior |
| --- | --- |
| Show learners declining in Mathematics | Resolve an authorized subject and class; show comparable trends with evidence; ask for class only when ambiguous |
| Who needs support with fractions? | Resolve an exact outcome/topic mapping; show matching evidence-backed learners; no substring guess that mutates data |
| Create practice for these eight learners | Preview learners, outcome and an existing certified practice resource or draft builder; confirm assignment; preserve request ID |
| Show Charles since Term 1 | Resolve canonical learner and actual term; stop on duplicate names; retain transferred-class permissions |
| Who has not been assessed recently? | Explicit period and subject; distinguish zero evidence from an unavailable source |

Rules, filtering, comparison and authorized action routing need no LLM. An optional LLM may rephrase a teacher-approved explanation or author a reviewed draft; it cannot establish mastery, silently send messages or replace academic write authority. Individual preferences belong to that user; cross-user learning must not expose private learner data.

## Reports and external connectivity

Report headers show school/class/subject/year/term, selected policy, as-of date and evidence completeness. Separate teacher-private notes from shareable remarks. Parents receive only released evidence for their authorized child; aggregate school users need explicit scope. Support class teacher coordination without automatically granting every subject teacher access to every private note.

Use immutable released report snapshots with revision lineage; corrections create a new version. Print/PDF/CSV/XLSX must agree on visible filters and counts, neutralize spreadsheet formula injection and avoid exposing private notes by default. A printable VibeSchool school record is not automatically a KNEC-approved document.

Connectivity order: internal authoritative links → validated CSV/XLSX → scoped roster/grade exchange adapter → curriculum identifiers/exchange → named LMS integrations. OneRoster and CASE are useful standards targets. Their existence is not proof that VibeSchool implements or is certified for them. Map external IDs, enforce tenant boundaries, log imports, detect conflicts and support retry/replay without duplicates.

## Delivery and acceptance

This remains one consolidated mission with internal dependency stages, not separate competing modules.

1. Reconcile current/historical roster authority and academic release/mapping semantics.
2. Repair shared progress projection, term boundaries, comparable trends and completeness guarantees.
3. Connect workspace views to existing workbook, learner, support and report workflows; retain occurrence reflection links.
4. Close context inheritance and action receipts; prove the intervention and report lifecycle.
5. Verify deterministic Twin parity and staged external imports.
6. Run mobile, tenant-isolation, failure/retry, exports, exact-head CI, independent assurance and post-merge/production checks.

Mandatory scenarios: new teacher with no class; teacher with no evidence; unclaimed enrolled learner; missing identity; two learners with the same name; subject teacher versus class teacher; wrong/changed school; transfer with retained history; zero/ABS/missing/exempt; duplicate import; provisional versus released marks; stale mark correction; lesson taught with no outcome evidence; actual term and between-term dates; mixed assessment types; incomplete pages; duplicate source evidence; revoked membership; offline/slow response; stale async school load; unauthorized parent; overdue support; reassessment not released; corrected released report.

Acceptance measures:

- No duplicate entry for the same source result; every displayed judgement traces to its evidence and policy.
- Canonical enrolled learner count agrees across progress, workbook, attendance and assessment for the same scope.
- All 13 requested capabilities have implementation and end-to-end evidence; a link alone does not prove a completed action.
- Sheet/import/export parity verified on a 40-learner class and an explicitly bounded larger fixture.
- On mobile, open learner evidence and start support without losing context; test loading, empty, denied and retry states.
- Reading does not mutate academic or intervention state.
- Exact final-head checks and independent review pass; deployment/database parity and signed-in production journey proven separately.

Do not rate the production module 10/10 or call it the best based on this design. Compare task completion, time saved, duplicate-entry rate, data contradictions, understandable alerts and retained teacher usage in a real pilot. Research justifies these design choices; those measurements establish whether the product delivers.


## Investigation and candidate status — 3 October 2026

The candidate was reconciled with main `42725bf693f171c57906815c2eb7cc710001d914`, including the merged Personal Twin and Workbook closure. Bounded progress commands now enter the canonical Personal Twin service; the Teacher drawer retains its shared workflow.

Read-only production inspection found 79 current enrollments with no missing/deleted learner identity or class-school mismatch, and no overlapping active school terms. The evidence ledger contained 27 quiz records; 11 lacked both school and class scope. Assigned-teacher ledger evidence was absent, while source tables held 10 exam results, four CBC assessments and one marked homework submission. No released gradebook entries were present. These are inspection-time observations, not complete school learning coverage or a permanent audit.

The candidate reads authorized ledger evidence and existing CBC, released gradebook, exam and marked homework facts with explicit source identity. It preserves zero versus absence, recorded expectation levels versus numeric marks, and unknown homework maxima. It does not manufacture curriculum IDs from topic labels. Unmapped CBC support observations are visible for review, while trends require comparable outcome evidence. This repairs misleading empty views without declaring the legacy sources reconciled or released.

The production `teacher_get_class_roster` RPC was absent. Historical learner identity remains dependent on existing authorization; the candidate reports a failed historical read and permits recovery to the current roster. It does not bypass RLS. The existing intervention queue RPC refreshes state during a list call, so the requirement that reading never changes support state remains open.

Implemented in this candidate: canonical entry and context links, class/learner evidence views, shared source projection, real Nairobi term boundaries, current/historical error handling, sheet deep links, scoped support links, bounded deterministic Twin reads and regression coverage. Existing workbook and intervention features are reused; a navigation link does not prove assignment, reassessment or closure.

Still required for the full 13-capability module: complete roster/history authority, outcome mapping and release policy, source correction/duplicate receipts, intervention read/write separation and lifecycle proof, permissioned parent sharing, immutable report snapshots, validated imports/external adapters, accessibility/mobile pilot, independent assurance and signed-in production verification. No migration or production configuration was changed in this investigation. This is an implementation candidate plus finished design, not a claim that the full module is deployed or certified.
