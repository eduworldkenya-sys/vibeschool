# Grade 6 Fractions — original content integration handoff
Date: 2026-11-13
Repository: eduworldkenya-sys/vibeschool

## Exact canonical curriculum destination
- Curriculum source reference: `VS-CUR-G06-MA-2026#1.4`
- Grade: Grade 6; subject: Mathematics; strand: Numbers; sub-strand: Fractions
- Existing `cbc_strands.id`: `d8f452e0-3270-4389-ad86-646af8f26f6d`
- Existing active `curriculum_learning_outcomes.id`: `65cc88b5-0767-4c09-965c-0ce562f3fdae`
- Outcome: Add fractions having different denominators after finding an appropriate common denominator.
- Outcome verification `verified_at`: NULL (do not pretend curriculum certification).
- No published/certified Grade 6 Mathematics `learning_resources` were found at inspection.

## Editorial source files
- `content/curriculum/grade6/mathematics/fractions-addition.v1.editorial.json`: 63 explained practice prompts, 8 models, 20 exposed bank candidates, 5 quick-check items and teacher support.
- `content/curriculum/production/grade6-fractions-addition-20261113.md`: complete learner + teacher text.
- `content/curriculum/production/grade6-fractions-addition-assets/*.svg`: four real SVG teaching diagrams prepared as editorial source only.
- `scripts/test-grade6-fractions-addition.mjs`: regression audit.

## Preserved architecture and limitations
- Curriculum Map is the existing Grade 6 mathematics reader binding; never duplicate curriculum identities.
- Scheme of Work is teacher/school owned; use authorized `scheme_of_work.curriculum_outcome_id` + `scheme_lesson_outcomes` in a genuine teacher session. No fabricated teacher Scheme row.
- Learner content must be released via existing canonical `learning_resources` and `learning_resource_versions`; `UniversalLearnReader` is presentation-only and cannot bypass certification.
- Do not serve a new hardcoded Grade 6 lesson route or read this repository editorial JSON from client production.
- Source SVGs are NOT stored in the canonical visual library, require authenticated private asset intake and independent visual certification; never substitute repo file references as production visual IDs.
- Owner requested immediate publication, but connected SQL session was `postgres` with `auth.uid() = NULL`, `is_platform_owner() = false`. The `cla_certify_learning_resource_version` function explicitly requires a platform-owner session.
- Internal arithmetic review is NOT independent quality assurance. Secure exam bank must not reuse these exposed questions as unseen questions.

## Acceptance / go-live
1. Independent mathematical/education review of all content and answers.
2. Create canonical resource candidate using approved intake with real subject, strand and outcome IDs; inspect immutable hash/version.
3. Verify candidate, rights and references through the actual authorization path.
4. Register and certify four visuals through the existing private visual asset system; use version-pinned `[visual:UUID@VERSION_UUID]` references in a new certified lesson version.
5. Certify lesson with authenticated platform-owner approval or a separately commissioned, policy-approved authority; do not impersonate.
6. Confirm public reader resolves only certified content and teacher scheme remains linked to the existing outcome.
7. Test signed-in and independent learner, teacher lesson preview, explanation reveal, quiz feedback, mobile and inaccessible/unauthorized paths.
8. Verify production Vercel deployment and exact live URL.

Current record: EDITORIAL_CONTENT_PREPARED; CANONICAL_OUTCOME_MATCHED; NO_CERTIFIED_LEARNER_RESOURCE; VISUALS_NOT_REGISTERED; SCHEME_SAVED_LINK_NOT_PRESENT; NOT_LIVE.
