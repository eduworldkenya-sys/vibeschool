# P0 — Assessment and question lineage (outcome packages)

## Authority

**Do not create a second question bank, attempt engine, or marking service.** The canonical record is `assessment_items.id`; `assessment_item_outcomes` is the stable curricular connection. `outcome_package_resource_id` points to the canonical `learning_resources.id` package anchor, while `source_resource_id` and `source_block_id` preserve the actual teaching source. A future package manifest references these **existing item IDs**, not hardcoded question copies. `variant_of_item_id` describes parentage without merging identities.

This contract is **additive**: historical rows have `lineage_contract_version=0` (unknown certification status, NOT automatically passed). A newly checked item has version 1 and retains its existing assessment, section, attempt and response relationships. No backfill falsely marks historical answers reviewed.

## Required content producer / operator sequence

1. Reconcile the real KICD learning outcome against the persisted VibeSchool curriculum before authoring. Use the stable `curriculum_learning_outcomes.id`, not a manuscript heading or an invented ID.
2. Resolve an **active**, scoped `learning_resources` package root; verify subject, curriculum and sub-strand against the outcome and assessment. Generic, unscoped resources are not eligible.
3. Create/keep the question in the existing `assessment_items` collection in draft. Provide `question_type`, prompt, answer or marking rubric, an explanatory rationale and (for Maths numeric/structured questions) an explained `worked_solution`. Provide `source_block_id` for approval under the existing source-grounding gate.
4. Independently check the answer, reasoning, distractors/rubric and any Maths working. Capture **actual check evidence**, not an assumed automated approval: `{"method":"independent_solution","summary":"...at least 20 characters..."}`, or `rubric_review` / `second_pass_check`.
5. Call `exq_certify_outcome_package_question` as the authorized teacher/platform owner with: `p_item_id`, `p_package_resource_id`, `p_outcome_id`, `p_intended_learning_use`, `p_eligible_uses`, `p_exposure_policy`, `p_answer_check_evidence`, and optional `p_variant_of_item_id`. It inserts the verified `assessment_item_outcomes` link if missing, stamps the checker identity/time and persists eligibility. **Certification does not approve, assign or publish.**
6. Use the existing assessment approval/publication, learner attempt, immediate/controlled feedback, marking and review paths. Their existing groundings and release policies still apply.

## Policies

| Question role | Intended learning use | Allowed eligible uses | Exposure |
| --- | --- | --- | --- |
| Guided activity | `guided_practice` | `exercise`, `topic_practice` and/or `quiz` | `formative_revealable` |
| Independent exercise | `independent_practice` | `exercise`, `topic_practice`, `quiz` and/or `diagnostic` | `formative_revealable` |
| Later retrieval | `revision` | `topic_practice` and/or `quiz` | `formative_revealable` |
| Initial/diagnostic check | `diagnostic` | `diagnostic` | `formative_revealable` |
| Fresh protected variant | `formal_exam` | **only** `formal_exam` | `protected_until_release` |

The assessment type must match an approved use: `practice` maps to `topic_practice`; `homework` and `exercise` map to `exercise`; `quiz` maps to `quiz`; `diagnostic` maps to `diagnostic`; `test` and `exam` map to `formal_exam`. A formative item is never eligible for a formal exam. An exposed prompt cannot be copied verbatim to a protected formal variant; an approved checked item's content and answer cannot silently change. Instead create a new item ID and record variant parentage. Protected items cannot be promoted into the reusable historical question bank.

**Exposure policy does not reveal answers by itself.** Existing assignment feedback and result-release rules decide **when** the explanation becomes visible. The existing `exq_start_or_resume_attempt` response was inspected: it serves item ID, type, prompt, options, marks, order, media and hint, **not** `correct_answer`, `accepted_answers`, `marking_guide`, `explanation` or `worked_solution`.

## Verification / status honesty

- A checked answer requires an actual independent review; the RPC validates the review evidence, **not mathematical or educational truth by itself**.
- A checked question is **not** an approved or published question.
- A linked outcome is **not** a completed learner competency or released exam.
- Existing historical items (`lineage_contract_version=0`) remain unchanged; inspect them before any future mass certification or migration.
- When an assessment declares `generation_metadata.outcome_package_resource_id`, publication cannot include any uncertified active item.
- Existing `enforce_assessment_item_grounding` still blocks approval without `source_block_id`.
- The migration was parsed and its positive/negative database smoke tests run inside **rollback-only transactions**. Production migration application, CI and signed-in learner journeys must be verified separately before claiming live delivery.

## Non-negotiable acceptance checks

- Outcome and package root are real, scoped and linked; unresolved aliases and draft/archived outcomes fail closed.
- Answer, explanation, checked evidence, declared instructional role and eligible use are recorded.
- Formative item cannot be configured as formal; protected item cannot be reused by practice/quiz or promoted to reusable question bank.
- A revealed prompt cannot be silently recast as protected; a protected variant needs its own identity, review and distinct prompt.
- Changing the checked prompt/key/marking/rubric does not rewrite earlier learner evidence.
- Learner question fetch contains no protected answer fields; existing result-release boundary stays authoritative.
- A draft checked item is not falsely counted as approved, published or visible.
