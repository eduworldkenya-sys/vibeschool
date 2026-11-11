# VibeSchool Content Package Template — Grades 1–9

Use this template **per subject, term, sub-strand or batch**; declare the exact scope. It operationalizes [CONTENT_PRODUCTION_STANDARD.md](./CONTENT_PRODUCTION_STANDARD.md) without creating a separate approval system or content engine.

**This is a working manifest, not a form the VibeSchool owner must complete.** Production agents/teams populate it from source evidence, existing canonical records and performed checks. Do not replace missing evidence with signatures, guesses or “verified” labels.

## 1. Package identity

| Field | Value |
| --- | --- |
| Grade | |
| Subject and language | |
| Declared coverage | Whole subject / specified term(s) / strand(s) / sub-strand(s) |
| Curriculum system and design | |
| KICD source URL/document reference | |
| Design revision/date | |
| Source checked on and section/page | |
| VibeSchool package ID / version | |
| Existing canonical publication / chapter references | |
| Content authoring state | Unmapped / mapped / drafted / content-complete |
| Quality evidence state | Not checked / partially checked / checked / independent review where required |
| Release / visibility state | Not authorized / authorized / published / learner-visible — use only proven state |

**What is excluded?** Explicitly list exclusions. Do not claim a full subject if this package covers only one term or sub-strand.

## 2. Source-to-outcome coverage ledger

Add one row for **every required curriculum outcome**, not just the easiest ones.

| Source strand → sub-strand | Stable outcome ID and brief VibeSchool formulation | Official source section | Lesson allocation/pacing if applicable | Content/assessment references | Coverage and evidence state |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

Cross-check the total against the official source, explain any source-version differences, and separate **annual authority** from school-specific Scheme of Work timing.

## 3. Outcome learning packet

Duplicate this block for each outcome, or reference its canonical record.

**Outcome ID:**  
**Learner can:**  
**Prerequisites / vocabulary:**  
**Concept explanation / learner notes:**  
**Worked example / demonstration (where useful):**  
**Activity / investigation / discussion / performance:**  
**Guided practice / exercise:**  
**Assessment question(s) or observable performance:**  
**Answer key / sample answer / rubric / feedback:**  
**Likely misconception and correction:**  
**Remedial path and enrichment:**  
**Teacher Guide: preparation, prompts, resources, differentiation and evidence to observe:**  
**Related competencies / values / PCIs where relevant:**  
**Safety / accessibility / low-resource alternative:**  
**Source and canonical resource/item IDs:**  

For any non-applicable element, record **why this outcome is better served another way**; do not paste a generic N/A.

### Learning component selection

| Component group | Included? | Canonical reference or outcome-based reason for omission |
| --- | --- | --- |
| Learn: explanation, example, relevant media | | |
| Explore: activity, discussion, experiment or performance | | |
| Practise: guided/independent exercises, worksheet or assignment | | |
| Check: question/quiz, observation, project or performance rubric | | |
| Improve: feedback, revision, remediation/enrichment | | |
| Teach: instructions, guide, material and assessment support | | |

## 4. Practice and question integrity

For each reusable assessment item or set, preserve:

- stable **item ID**, associated curriculum outcome(s) and content taught;
- item type, prompt, language, accessible alternatives, complexity and intended feedback mode;
- correct answer **with explanation**, sample response or performance rubric and marking points;
- plausible but non-deceptive distractors where multiple-choice;
- misconception/feedback path for wrong, skipped or incomplete answers;
- eligibility for **exercise, topic practice, quiz and/or formal exam** without confusing their different rules;
- evidence the answer was actually checked.

**No separate question-bank copy for each consuming tool.**

## 5. Canonical binding audit

Record the **real** IDs and inspected links instead of placeholders in the deployed system.

| Link | Expected | Evidence / status |
| --- | --- | --- |
| Official source → curriculum map | Correct grade/subject/outcome identity | |
| Curriculum map → Scheme of Work | Outcome references preserved; no forced timetable | |
| Scheme / chosen curriculum outcome → Lesson Plan | Exact lesson context; correct term/week if scheduled | |
| Lesson Plan → Notes / Teacher Guide | Correct selected lesson and content | |
| Canonical chapter/resource → VibeLearn reader | Age-appropriate content renders | |
| Content → exercise/assessment item | Correct outcome and solution | |
| Assessment → learner progress | Only real evidence, no invented marks | |
| Independent learner route | No teacher/class/timetable approval dependency where public access policy allows | |

Use existing Content Engine objects and links; do not assume the schema solely from this template.

## 6. Quality and defect register

| Check | Result and direct evidence | Required correction / disposition |
| --- | --- | --- |
| Official source provenance and coverage | | |
| Correctness of explanations, examples and answers | | |
| Sufficient teachable depth for outcomes | | |
| Practical instructions, feasibility and safety | | |
| Age, accessibility and inclusive Kenyan contexts | | |
| Originality / source and media rights | | |
| Question/rubric and feedback integrity | | |
| Teacher usability and independent learner readability | | |
| Canonical links and no duplicate authority | | |
| Independent evaluator/critic where required | | |

**Result values:** PASS / FAIL / NOT_APPLICABLE (with reason) / NOT_CHECKED. Do not convert NOT_CHECKED into PASS. Attach references, version, time and actual verifier identity/type for substantive checks.

**Repair log:** What was wrong, which outcome/consumer it affected, where it was repaired in canonical content, and what was rechecked?

## 7. Release and learner-access evidence

- **Publishing authority:** Which *existing* authorization and release process applies?
- **Publishing result:** Exact release state and recorded evidence; do not infer from a merged PR.
- **Teacher journey:** Can a teacher view the curriculum and prepare scheme/lesson/notes/guide without a timetable? Does an actual scheduled lesson preserve its occurrence identity?
- **Learner journey:** Can an eligible independent learner open content, complete practice and receive correct feedback?
- **Assessment journey:** Do eligible questions load and mark correctly under their intended exam/practice policies?
- **Runtime evidence:** Environment, actual route, observed state, date, and any access restrictions.
- **Known limitations:** Accurate scoped report, not a generic “ready”.

## 8. Autonomous execution / escalation rule

**Routine production needs no repeat approval from the owner:** obtain official evidence, author, revise, check, map, create a release candidate and fix ordinary errors within existing capabilities.

Escalate only a **proven necessary** decision or capability boundary (for example, a true rights issue, consequential safety uncertainty or release authorization under the existing policy). Name the exact boundary and finish every safe preparatory task first. Never fabricate human verification or silently bypass a mandatory release gate.

## 9. Completion statement

Write one scoped statement grounded in evidence:

- **Content-complete for [exact scope]:** every applicable outcome packet has the required learning evidence.
- **Quality-checked for [exact version]:** the named quality checks and independent review (if required) passed, with references.
- **Published / learner-visible for [exact scope]:** existing release authority was satisfied and the real consumer journey was verified.

The three statements are **not interchangeable**. An unreviewed manuscript can be content-complete but not publication-ready. A repository policy commit can exist without any learner content being live.
