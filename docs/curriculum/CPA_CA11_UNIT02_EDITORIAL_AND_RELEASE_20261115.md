# CA11 Applied Accounting Workshops — Editorial and Release Record
**VibeSchool Originals | CPA Foundation | CA11 Financial Accounting | 15 November 2026**

## Concurrency reconciliation
While this unit was being authored, another independently reviewed VibeSchool contribution merged as [PR #1756](https://github.com/eduworldkenya-sys/vibeschool/pull/1756). Production confirmed it **already published** the first three Accounting Process core topics at positions 4–6, with 14 new questions. The introductory Unit 01 remains at positions 1–3 with 12 questions.

That release is the canonical core. This proposal **does not replace, copy, delete or alter** it. The additional material is deliberately positioned as **five applied workshops, positions 7–11**. They teach the same KASNEB subsections through a different practical business file, with sustained work on source verification, account posting, reconciliation and judgement rather than a second competing core syllabus.

No duplicate source-of-truth, second exam engine, school identity, learner enrollment table or user role is introduced.

## Primary and supplementary sources
- KASNEB *CPA Reviewed Examination Syllabus*, June 2024, Foundation Financial Accounting printed page 1, subsections 2.1–2.5: https://www.kasneb.or.ke/wp-content/uploads/2024/09/CPA-Syllabus-Reviewed-June-2024.pdf
- KASNEB April 2026 qualifications booklet confirming CA11 Foundation paper: https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf
- ACCA duality and double-entry explanation: https://www.accaglobal.com/gb/en/student/exam-support-resources/foundation-level-study-resources/fa2/fa2-technical-articles/a-matter-of-principle.html
- ACCA computerised sales and purchase accounting: https://www.accaglobal.com/africa/en/student/exam-support-resources/foundation-level-study-resources/fa1/technical-articles/sales-comp-acc-system.html
- IFRS Conceptual Framework: https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/

Authoring is **VibeSchool-original**: no copied official teaching text or exam papers. Syllabus sections establish educational scope.

## New workshops
| Position | Original applied lesson | Syllabus capability | Guided MCQs |
|---|---|---|---:|
| 7 | Audit a real invoice trail | 2.1 Source documents, receivables, settlement and evidence | 6 |
| 8 | Record a week of business evidence | 2.2 Journals, returns, cash and petty cash | 6 |
| 9 | Post the full Nuru Repair Studio ledger | 2.3 Double entry and account movements | 6 |
| 10 | Rebuild and challenge a trial balance | 2.4 Account balances, detecting errors | 6 |
| 11 | Present August's results to the owner | 2.5 Profit and financial position, reporting judgement | 6 |

The new authoring files are under `content/college/cpa/ca11/unit02/` and contain **45 substantial teaching sections, thirty question/answer pairs**, contextual examples, misconceptions and guided checks. The three earlier Accounting Process lessons remain the first step; these are practical extensions, not repeated core links.

## Recalculated accounting model
The *Nuru Repair Studio* case is an original, separate nine-transaction file. No opening balances, VAT, tax, depreciation, inventory or other adjustments are assumed. August advertising is entirely consumed. A KSh 9,000 request for a future repair quote is **not posted**, because no revenue has yet been earned.

| Account | Debit KSh | Credit KSh |
|---|---:|---:|
| Bank | 164,000 | |
| Equipment | 60,000 | |
| Trade receivables | 15,000 | |
| Rent expense | 12,000 | |
| Advertising expense | 8,000 | |
| Drawings | 4,000 | |
| Capital | | 180,000 |
| Service revenue | | 80,000 |
| Trade payables | | 3,000 |
| **Trial balance** | **263,000** | **263,000** |

Profit = KSh 80,000 − 20,000 = **KSh 60,000**. Closing owner equity = 180,000 + 60,000 − 4,000 = **KSh 236,000**. Assets total KSh 239,000, agreeing with liabilities 3,000 + equity 236,000. Tests must reconstruct these figures independently from source transaction entries and reject deliberately incorrect entries or answer keys.

## Publication, data protection and scope
- The reviewed current database baseline is **6 published topics, 26 practice questions**, not the original pre-concurrency 3/12.
- The new staging SQL expects **exactly 6 existing published topics**, their identifiers/sequences 1–6 and 26 questions, and no other CPA paper content. It adds only **five `in_review` topics and 30 new questions** in the current Academy storage spine.
- The separate release SQL validates every new question text and corresponding answer key, four options, substantive explanations, exactly five eligible topics at positions 7–11, and original 6/26 unchanged. It publishes **only** the five named workshops.
- Post-release canonical expected state, if commissioned and verified, is **11 published CA11 topics / 56 questions**, and no new public privilege, authorization, course-status, user-profile or other-paper mutation.
- Publishing is **not** authorised by a green merge alone. The reviewed exact-head CI/security/blank-rebuild gates and production readback precede commissioning. Do not mutate production if current competing content changes the baseline again.
- Supabase application assigns ledger versions. Reconcile local migration filenames to those actual versions after any controlled application, without rewriting deployed SQL or altering ledger entries.
- If the release is blocked, preserve the authored workshop source. Do not force the course counts or silently overwrite existing published material. Rollback/unpublication, if ever required, must target only the new five topic IDs and preserve learning-progress references.

No independent human CPA reviewer or full mobile journey is claimed. This contribution strengthens applied independent learning for KASNEB CA11 subsection 2 only; Section 3 onward remains outstanding and official KASNEB qualification is not issued by VibeSchool.
