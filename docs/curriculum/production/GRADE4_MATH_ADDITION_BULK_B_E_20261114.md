# Grade 4 Mathematics Addition — Bulk editorial verification, 14 November 2026

**State:** FOUR EDITORIAL CANDIDATE PACKAGES COMMITTED; NOT SOURCE-PROMOTED, INDEPENDENTLY CERTIFIED, PUBLISHED OR LEARNER-TESTED.

## Authoritative source / scope

- KICD *Grade 4 Mathematics Primary School Curriculum Design*, first published 2017, **revised 2024**, at https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf.
- The official KICD-hosted PDF text was inspected in this session: **Strand 1.0 Numbers → 1.2 Addition, printed pp. 4–5 (PDF indices 12–13)**. The five outcomes are (a) one regrouping; (b) two regroupings; (c) sum estimate rounding to tens; (d) addition number patterns; (e) everyday application. The sub-strand suggests **8 lessons**, not one per outcome. The PDF screenshot fetch returned a cache miss; the official *text* was verified, but the page visual was **not** independently inspected.
- Do not substitute the existing weekly `curriculum` Operations/Addition row for the official Numbers/Addition hierarchy.
- `curriculum_authority_sources` has **zero** Grade 4 Mathematics source rows, **zero** promoted snapshots, and **zero** verified outcomes in the checked canonical Grade 4 Mathematics chain. Publicly available PDF text is **not** authenticated canonical source intake, artifact checksum or protected promotion.

## Bulk production artifacts

- Existing **1.2(a)** draft, kept separate: PR #1691, `content/curriculum/production/grade4-mathematics-addition-1.2a.v1.editorial.json` on its own unmerged branch; **do not create a duplicate**.
- This batch supplies four substantive source-scoped VibeSchool-original editorial packages for **1.2(b–e)** at `content/curriculum/production/grade4-mathematics-addition-1.2-b-to-e.v1.editorial.json`.
- Each includes a learner explanation, five-step worked model, guided question, low-cost activity, three independent exercises, five formative questions with answers, reasoned feedback, revision, remedial and enrichment help, teacher guidance and a visual authoring brief.
- A deterministic test `scripts/test-grade4-math-addition-bulk-editorial.mjs` validates identity, candidate status, uniqueness, structure, addition sums, exactly two regroupings for outcome (b), rounding for outcome (c), and the repeating-step model for outcome (d). The candidate JSON was inspected at authoring and re-read through the GitHub connector. **Repository CI execution is not claimed.**
- Across the four new packages: **20 formative items, 12 independent exercises, four worked models**. These are not assessment-bank items or released questions.
- There is no guarantee that covering the five outcomes with one editorial package each equals the official **eight suggested lessons**; full instructional sequencing and further practice coverage require review.

## Existing assets actually found

- Grade 4 Mathematics: **12 active public certified resource versions** (Time topic); they are not Addition core resources.
- The existing Grade 4 Mathematics publication remains a **draft**. An existing place-value practice assessment is published, but is not the new Addition learning pack.
- The Grade 4 Mathematics subject catalog already contains structural original teaching guidance for Addition. This batch adds detailed original materials without modifying the catalog or existing learner data.

## Safe bulk pathway, without duplicate systems

1. Authenticate existing curriculum-authority source registration and record the real KICD artifact bytes, edition and verified SHA-256. Do not guess the hash or impersonate the owner through SQL.
2. Register/reconcile the exact existing Numbers/Addition sub-strand, 1.2(a–e) outcome identities and official source locators through existing `curriculum_authority_*` snapshots and promotions. Preserve teacher-owned weekly Scheme rows.
3. Validate the five packets together: existing #1691 (a) plus this batch (b–e). Execute actual repo tests, editorial/independent review and visual production as applicable; fix any failing items.
4. Use existing `learning_resources` and immutable `learning_resource_versions` to make candidate versions and outcome-linked assembly manifests. Never submit invented IDs or create a second library.
5. Use existing authorised publishing/certification gates, and independent learner read-back (Learn → Topic Practice → Feedback → Revision → Progress). No protected writes are justified by the read-only connector.

**Batch processing is feasible for drafting and structural/arithmetic checks now.** Bulk **canonical release is blocked by verified source authority and authenticated certification**, not by a need to rebuild the content engine. The production database contains an `hq_publish_original_topic_batch` function for assessment publishing, but its existence does not certify curriculum content and is not a general lesson-publishing capability.

## Next queue

Continue to 1.3 Subtraction only after confirming revised 2024 KICD scope and existing material. Do not advertise Grade 4 Mathematics as content-complete until every source-reconciled outcome and instructional component is verified and released.

## Access limitation / governance

This work uses GitHub editorial writes on an isolated branch and read-only Supabase inspection. No production write, source authority promotion, publishing, RLS changes, automated worker activation or learner-facing deployment was performed. Cyborg exact-head mission/lease/independent release gates remain applicable, and are not claimed to have run in this ChatGPT connector session.


## Follow-on execution — same-day senior repair

- Added a path-scoped GitHub Action: `.github/workflows/grade4-math-addition-editorial.yml` executes `scripts/test-grade4-math-addition-bulk-editorial.mjs` for changes to this editorial batch. CI results must be checked against the exact current head.
- Converted four mere diagram briefs into actual source-controlled, accessible SVG candidate visuals at `content/curriculum/production/visuals/grade4-addition-1.2{b,c,d,e}-*.svg`. They show two regrouping exchanges, number-line rounding, a five-term +125 addition pattern, and a combined-quantity bar model. These are **candidate illustrations**, not certified in the visual library or live in Learn.
- Extended the test to verify outcome-specific diagrams, accessible labels, the displayed calculation result, source URL, and explicit draft-only/no-bank/no-authority states. This test is a repeatable editorial **preflight**, not a replacement for educational review or publication authorization.
- Current production source pipeline is `curriculum_authority_register_source → artifact intake/verified checksum → snapshot observations → seal/reconcile → authenticated hierarchy binding → re-reconcile → owner promotion`. The service edge function expressly requires an authenticated platform-owner identity; SQL access or the user's standing preference to avoid HQ does **not** furnish an equivalent user session or authorise impersonation.
- The first `1.2(a)` draft is still isolated under PR #1691. A combined release will need careful integration after that exact candidate is reviewed; do not copy its manuscript into this PR and create duplicate package identities.
