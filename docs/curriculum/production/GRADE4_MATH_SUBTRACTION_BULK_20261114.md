# Grade 4 Mathematics — Numbers 1.3 Subtraction, bulk editorial handoff

**Audit date:** 14 November 2026 (Nairobi). **State:** five original candidate packages; no canonical source promotion, no independently certified outcomes, no publication or learner read-back.

## Source and scope
KICD regular **Grade 4 Mathematics Curriculum Design**, revised 2024:
https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf
Strand **1.0 Numbers**, sub-strand **1.3 Subtraction**, printed pp. 6–7 (PDF page indices 14–15); **eight suggested lessons**. The official text was inspected. The PDF page-image screenshot retrieval returned a cache miss and the independently immutable source artifact is not registered through the platform owner-gated intake. We did not invent a document hash.

Official source intent in original words:
(a) subtraction of up-to-four-digit numbers without exchanging; (b) subtraction with exchanging; (c) estimate differences via rounding to nearest tens; (d) patterns involving subtraction within the 10,000 range; (e) application of subtraction in practical situations.

## Inventory and reuse
- Existing Grade 4 Mathematics subject catalog has a 1.3 Subtraction high-level unit; preserve identity, do not duplicate that catalog.
- Existing weekly `curriculum` rows are a **separate unverified calendar/topic scaffold** (including `Operations / Subtraction`), not a promoted KICD outcome chain. Do not overwrite scheme or teacher rows.
- Separate completed *editorial* draft PRs: **#1691** for Addition 1.2(a), **#1693** for Addition 1.2(b–e). Both distinct and not automatically integrated with this branch.
- Twelve certified/public Grade 4 Mathematics Time resources and published place-value topic practice remain available for their actual subject scopes, not as substitutes for these Subtraction lessons.

## Artifacts
- `content/curriculum/production/grade4-mathematics-subtraction-1.3a-e.v1.editorial.json`: five substantively different learner packages, worked step rationales, low-cost activities, guided questions, three independent exercises per package, five formative questions per package, answer feedback, revision, differentiation and visuals brief.
- `scripts/test-grade4-math-subtraction-bulk-editorial.mjs`: draft-only/source identity/no fabricated outcome IDs, unique question IDs, arithmetic and nearest-ten estimation, subtraction-pattern checks.
- `.github/workflows/grade4-math-subtraction-editorial.yml`: executes the test against the candidate PR.

**Production:** 5 scoped outcome manuscripts, **25 editorial formative checks**, **15 independent exercises**. These are **not** official content versions, certified visuals or newly published assessment items. A few visual briefs need final accessible graphics; do not imply they already exist as certified assets.

## Bulk acceptance and blocker
- Editorial authoring and answer assertions: authoring-time checks performed, recurring CI wired; exact-head workflow result must be checked before progressing.
- Official KICD scope observed, but the production `curriculum_authority_sources` has **zero registered Grade 4 Mathematics sources**; source snapshots and official outcome promotion are absent in the checked chain.
- Existing `curriculum-authority-intake` requires owner-authenticated registration / protected promotion, and service functions only stage immutable evidence. The requested no-HQ-owner-admin user experience is valuable but does not confer owner credentials inside the SQL connector.
- One authoritative source intake may support **both** Addition 1.2 and Subtraction 1.3 without repeating the same source artifact 10 times. Register once and reconcile all exact outcome IDs through the existing governance.
- The eight suggested lessons are **not** claimed complete by five outcome drafts; sequence these, add exercises and assess demonstrated learner mastery after protected source authority and independent review gates.
- No migrations, privilege changes, SQL writes, source promotions, publishing or live tests have been performed here.

## Following work order
1. Reconcile the single existing official source artifact and both adjacent Numbers sub-strands; preserve author and scheme identities.
2. Run exact-head CI and independent pedagogical/math/rights review of both batches; repair and retest.
3. Create/reuse certified immutable `learning_resources` versions and canonical outcome package manifests once IDs have been promoted; no parallel engine.
4. Publish only under existing owner-authorized release and verify independent learner Learn → Practice → Feedback → Revision → Progress.
5. Continue to KICD Numbers 1.4 Multiplication using the same bulk authoring workflow only when equivalent source and reuse checks are completed.
