# VibeSchool CPA — CA11 Unit 02 Editorial and Release Record
**Title:** From Evidence to Financial Statements  
**Examining body:** KASNEB (curriculum alignment only; VibeSchool is not KASNEB)  
**Paper:** Foundation CA11 Financial Accounting  
**Date:** 15 November 2026

## Scope authority
Official source is KASNEB's *CPA Reviewed Examination Syllabus, June 2024*, printed page 1, **2.1–2.5**, verified against current public syllabus material. The sections are, respectively, source evidence; books of original entry; ledgers and double entry; trial balances; financial statements. The dated April 2026 KASNEB qualification booklet confirms the CA11 paper identity. The conceptual technical cross-check uses ACCA explanatory resources on the double-entry system and computerised sales/purchases, plus the IFRS Foundation Conceptual Framework.

- Official syllabus: https://www.kasneb.or.ke/wp-content/uploads/2024/09/CPA-Syllabus-Reviewed-June-2024.pdf
- CA11 paper identity: https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf
- ACCA on duality: https://www.accaglobal.com/gb/en/student/exam-support-resources/foundation-level-study-resources/fa2/fa2-technical-articles/a-matter-of-principle.html
- ACCA on computerised sales/purchases: https://www.accaglobal.com/africa/en/student/exam-support-resources/foundation-level-study-resources/fa1/technical-articles/sales-comp-acc-system.html
- IFRS Conceptual Framework: https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/

All lesson wording, examples, case transactions and practice questions are VibeSchool-original. Official syllabus labels and ideas identify scope; protected source passages have not been transcribed into student text.

## Learning content
The authoring source is the four JSON files under `content/college/cpa/ca11/unit02/`. Publishing uses **the existing Academy spine** `courses → modules → topics → quiz_questions`, not a second reader or exam engine.

| Sequence | Subsection | New topic | Practice |
|---|---|---|---|
| 4 | 2.1 | A transaction begins with evidence | 6 original MCQs |
| 5 | 2.2 | Choose the right first record | 6 |
| 6 | 2.3 | Make each transaction balance | 6 |
| 7 | 2.4 | Prove the ledger totals | 6 |
| 8 | 2.5 | Turn balances into a business report | 6 |

Forty-five substantive teaching sections plus Kenyan contextual examples, common-error interventions, practice prompts and specific answer explanations support self-directed study.

## Accountant's working example: Nuru Repair Studio
The example uses **nine** recordable August transactions and a separate non-postable customer quotation. Nine journal entries correspond to these source-level events: capital contribution, equipment purchase, completed credit repair, completed banked repair, rent payment, advertising received on credit, credit customer payment, part supplier settlement and owner drawings. A KSh 9,000 request for a quotation is explicitly **not** recognised as earned income.

The entries produce:

| Account | Debit, KSh | Credit, KSh |
|---|---:|---:|
| Bank | 164,000 | |
| Equipment | 60,000 | |
| Trade receivables | 15,000 | |
| Rent expense | 12,000 | |
| Advertising expense | 8,000 | |
| Owner drawings | 4,000 | |
| Capital | | 180,000 |
| Service revenue | | 80,000 |
| Trade payables | | 3,000 |
| **Total** | **263,000** | **263,000** |

From the same balances: profit KSh 60,000; assets KSh 239,000; trade payable KSh 3,000; closing owner equity KSh 236,000. Both totals and the equation `239,000 = 3,000 + 236,000` are derived by independent programmatic computation from the **nine transaction inputs**, not hardcoded only as final claims.

Teaching assumptions: no opening balances, VAT, tax, depreciation or other adjustments; advertising service completely used in August. The statements are instructional, not presented as a complete IFRS annual reporting package.

## Adversarial quality gates
1. The editorial manifest `coverage` must match exactly 2.1–2.5 and no other syllabus portion.
2. Five immutable original topics with sequence numbers 4–8; six distinct original questions and checkable answer key per topic.
3. All five lessons require sustained explanation, Kenya-specific application, misconceptions and practice/checking prompts; feedback text is substantive.
4. Reconstruct the general ledger from nine journal entries and calculate trial balance, profit, equity and financial position; negative tests mutate transactions, syllabus sections, answer keys and invent a tenth posting to ensure failures are detected.
5. Stage SQL embeds the exact JSON packet and changes only five new `in_review` rows and thirty questions, preserving all three published Unit 01 rows and their twelve questions. No new RLS, grants, account or payment mutation.
6. Publication SQL fails closed if prior content is missing, a question/answer changes, a unit topic is missing, another CPA paper contains unreviewed topics or numeric question inventory drifts. Only the named five topics can change `in_review → published`.
7. Required exact-head CI, migration security, blank database reconstruction, source/code consistency and post-release database verification before claiming that the unit is live.

**External human peer review was not performed or claimed.** Automated, adversarial and editorial checks are meaningful but limited. Any unresolved syllabus interpretation or number discrepancy blocks public publication.

## Recovery and rollout
Migrations are deliberate, ordered production actions, not automatically executed by merging. Use the previously established exact Supabase ledger-version reconciliation after any controlled production application. Each migration is atomic and validates preconditions. A production rollback would require a separately reviewed, narrowly scoped **unpublication** of only the five new topics, never deletion of existing learner progress or Unit 01 rows.

This release is only CA11 Section 2.1–2.5. The remainder of Financial Accounting and advanced registration-code reconciliation stay open in #1745. Signed-in Android/PWA journey verification remains a separate operational gate; SQL success alone cannot certify that interaction.
