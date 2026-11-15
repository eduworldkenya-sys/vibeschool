# CPA CA11 — Unit 01 authoring and release record
Date: 2026-11-15 | Programme: KASNEB CPA Foundation | Paper: CA11 Financial Accounting

## Authoring scope
KASNEB June 2024 CPA detailed reviewed syllabus, printed p.1, Introduction to Accounting sections 1.1-1.5.
- 1.1 purpose and nature -> `why-accounts-matter`
- 1.2 goal of reporting -> `why-accounts-matter`
- 1.3 financial-statement elements -> `five-elements-of-financial-statements`
- 1.4 accounting equation -> `the-equation-in-action`
- 1.5 information users -> `why-accounts-matter`

The paper code CA11 is independently confirmed in the April 2026 KASNEB qualifications booklet (printed p.5). No claim is made about later CA11 syllabus amendments that have not been checked. This release candidate covers **only** the introductory unit, not all CA11 topics or a complete CPA course.

## First-party research and concepts
1. KASNEB original reviewed syllabus (June 2024): https://www.kasneb.or.ke/wp-content/uploads/2024/09/CPA-Syllabus-Reviewed-June-2024.pdf — page 1, sections 1.1-1.5. Original content written by VibeSchool from scope and educational goals; no reproduction of syllabus passages.
2. KASNEB qualifications booklet (April 2026): https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf — page 5, CA11 identity.
3. IFRS Foundation Conceptual Framework: https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/ — current technical framework for assets, liabilities, equity, income, expenses and general-purpose users.

## Editorial and technical audit
- 3 original learner topics; 21 explanation blocks plus Kenya examples, misconceptions and guided practice; 12 original multiple-choice practice questions, with four distinct response options, model answers and explanatory feedback.
- Worked equation verified against separate computational check: owner contribution 120,000; laptop 40,000 cash; inventory 30,000 on credit; pay supplier 10,000; service income 15,000 cash; owner drawings 5,000. Closing cash 80,000, equipment 40,000, inventory 30,000, trade payable 20,000, equity 130,000; **150,000 = 20,000 + 130,000**.
- Second worked figure: assets 65,000 + 14,000 + 21,000 = 100,000; liabilities 25,000 + 5,000 = 30,000; equity 70,000.
- Other computed answers: 180,000 − 65,000 = 115,000; 70,000 + 40,000 + 20,000 − 25,000 = 105,000.
- Negative test deliberately corrupts a question's correct-option ID: the content contract rejects it.
- Review checks distinguish cash from profit, payable vs receivable, planned spending vs present obligation, and drawings vs operating expense. Wording avoids unsupported claims of official accreditation or exam-paper prediction.
- The independent peer/external verification gate is **not** claimed. Automated checks catch structural and arithmetic errors, not every pedagogical or financial-reporting mistake.

## Safety gate: staged, never published by this change
The SQL material belongs under existing `courses -> modules -> topics` and `quiz_questions`. It must stage `in_review` under existing unpublished `kasneb-cpa -> ca11` and leave `courses.status=coming_soon`. It changes no school content, student IDs, RLS, publication grants, enrollments or live access.

### Production launch blockers confirmed by read-only inspection
1. `courses` RLS currently returns only `live` courses. The College selector tries to read `kasneb-cpa` while `coming_soon`; authenticated learner access cannot be assumed.
2. `modules` RLS permits modules only for live courses. The current selector expects 22 CPA modules before its course is live.
3. `public.learner_profiles` currently has **zero records**, and `course_enrollments.learner_id` / `learner_progress.learner_id` reference that table, while the UI sends `auth.users.id`. The learner pathway cannot be certified for enroll/save/resume as written.
4. `quiz_questions` has no browser SELECT grant/policy in the inspected production state. The practice tab cannot be claimed functional even for correctly authored questions.
5. Live learner interaction, cross-user RLS negative paths, source-revision checking, independent quality assurance and exact deployed-code verification remain required.

### Release decision
**NOT AUTHORISED TO PUBLISH.** The goal remains a complete independent study-and-practice cycle for Jean; do not flip the course status to live or mark topics published until the canonical reader, access, learner identity, question permissions and assessment integrity are fixed and proved. A draft SQL merge is not a production content release.

## Change recovery
Staging is additive and leaves all existing student data and public publication status untouched. If production staging is commissioned after exact-head CI, rollback should be by a reviewed, targeted removal of only the three unpublished topic identities and their own quiz rows, without touching learner data or other course modules. Do not run a broad rollback against future learner content.
