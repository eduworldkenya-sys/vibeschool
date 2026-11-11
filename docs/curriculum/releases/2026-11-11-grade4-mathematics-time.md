# Grade 4 Mathematics — Time release evidence (11 November 2026)

## Exact scope
VibeSchool-original content, **Grade 4 Mathematics / Measurement / 2.6 Time** only.
This is a complete sub-strand, **not** a complete Grade 4 Mathematics subject.
The 2024 KICD Grade 4 Mathematics design identifies seven Time outcomes (a–g) and ten suggested lessons on printed pages 32–33.

## Canonical identity
- Source: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf (2024 revision)
- Curriculum key: `VS-CUR-G04-MA-2026#2.6`
- Canonical sub-strand UUID: `e975dcc6-32a9-4274-a2a3-3d19e409cf5c`
- Authoring package: `content/curriculum/grade4/mathematics/time.v1.json`
- Ten `learning_resources` canonical keys: `vs:g4:mathematics:time:learner:lesson:01` through `10`
- Delivery: `learning_resource_versions` → `vs_public_grade4_math_time_learner_lessons()` → `/learn/grade-4/mathematics/time`
- Initial integration: PR #1401, merged commit `d8f7dc3dc1ded0a50d007cac0a7c8736d5d3d17c`
- Production deployment: `dpl_9dmJz9fPjU8MmopJpqjTJvzk1WQk`, Vercel **READY**, exact above commit.

## Content QA and release evidence
- Ten full lesson packets, with guided and independent practice, answers, explanations, activities, checks, remediation, enrichment and teacher guidance.
- Seven KICD outcome categories traceable through the content package.
- 72 stable practice/check question IDs with answer and rationale.
- Database SHA-256 hashes: 10/10 match canonical version payloads.
- Release was authorized by the owner's direct instruction to produce/publish and then continue.
- Release script: `scripts/sql/grade4_math_time_owner_delegated_release_20261111.sql`.
- **Reviewer is an AI-assisted database operator; not an independent human evaluator**. KICD is the educational scope reference, **not** the publisher or endorser.
- The operator used the existing `cla_verify_learning_resource_candidate` transition plus the previously established, tightly scoped owner-delegated certification precedent, without modifying any owner-only RPC, RLS policy, or public privileges.
- Dry-run release in a rolled-back transaction returned exactly ten lessons; real release committed on 11 November 2026.
- Post-release database checks: 10 certified/versioned resources with certification timestamps, 72 questions, 10/10 valid hashes, 10 public reader rows.
- An anonymous database role executing the public reader RPC returned 10 rows, lesson order 1–10. No teacher/class/timetable required.

## Validation limits
The actual browser page URL was not successfully fetched in this connector session (network/DNS restrictions); the production build is READY and the anonymous data-access contract was verified independently via the database. Do **not** label the browser E2E journey tested. No learner attempt, marking, progress or mastery was fabricated.
This release covers Time only; other Grade 4 Mathematics sub-strands remain outside this package.
