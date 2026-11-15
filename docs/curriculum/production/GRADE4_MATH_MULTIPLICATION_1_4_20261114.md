# Grade 4 Mathematics — Multiplication 1.4 editorial batch

**Status: EDITORIAL ONLY. NOT CERTIFIED, PUBLISHED, MERGED OR LEARNER-TESTED.**

## Official curriculum and existing records

KICD original regular Grade 4 Mathematics revised 2024, official document: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf. Printed pp. 8–9, PDF pages 16–17, **Numbers → Multiplication 1.4**, five outcome scopes (a–e), **8 suggested lessons**: multiply a two-digit factor by a multiple of ten; multiply two two-digit factors with/without regrouping; approximate products by rounding to tens when product does not exceed 1,000; multiplication patterns capped at 100; practical use. The PDF text was inspected directly. An attempted screenshot returned a cache miss; no independently downloaded source bytes or SHA-256 exist in this chat.

Already present: `lib/teaching/grade4MathematicsCatalog.mjs` includes the 1.4 unit; production `curriculum` includes legacy Grade 4 Mathematics `Operations / Multiplication / Multiplying by 2-digit Numbers` row (`d5bed71b-4569-447b-9dec-493fb641ddcf`). This legacy row is NOT an official verified Numbers 1.4 outcome and must not be overwritten. Scoped production search found no specific Grade 4 Mathematics multiplication learning resource by title.

## Newly authored work

`content/curriculum/production/grade4-math-multiplication-1.4-eight-lessons.v1.editorial.json`: eight distinct lesson drafts with original explanations, reasoned worked models, three guided steps/activities, numerical practice and feedback, teacher guidance, revision/remediation, and illustration briefs, mapped to official outcome scope (a,a,b,b,c,d,d,e). No duplicate content library or examination engine. Drafts are not completed canonical core+supplementary+revision package versions, and not enough to claim learner-visible eight-lesson publication.

`scripts/test-grade4-math-multiplication-editorial.mjs` and `.github/workflows/grade4-math-multiplication-editorial.yml`: validate the eight distinct identities, 16 arithmetic/model answer assertions, scope caps for estimated products <=1,000 and pattern products <=100, source identity and explicit null canonical IDs/deny-publication states. CI is repository-governed; passing math tests is not independent learning-quality certification.

## Release dependencies

Grade 4 Mathematics source authority has been observed but the production `curriculum_authority_sources` source and promoted canonical outcome identities remain absent in last verified audit. Exact owner-authenticated source intake, artifact-byte SHA-256 storage, hierarchy binding and promotion are required. Reuse PR #1702 for the KICD general-vs-adapted-source distinction; extend that observation under the same regular curriculum source once authorised. After the source is registered, independently check multiplication worked mathematics and pedagogy; bind real outcomes, canonical versioned resources and approved question IDs using the existing Content Engine; certify and publish via protected existing workflow; finally check learner readback and saved practice results. No protected mutations are performed in this editorial batch.
