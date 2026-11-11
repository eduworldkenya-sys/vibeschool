# Grade 1 Jumping — canonical private-content integration

**Scope:** Grade 1 Creative Activities / Creating and Executing / Jumping  
**Source:** VibeSchool Originals teacher and learner first-edition manuscripts, 11 November 2026  
**Publication state:** REVIEW CANDIDATE ONLY — **NOT** commercially certified or learner/teacher-visible  
**Content ownership:** The manuscript text belongs in private Supabase versions, **not** in this public source repository.

## Verified current authority

- Live Grade 1 Jumping `cbc_strands.id`: `a630072d-eb68-421a-87cb-492cad443c46`; its global subject is Creative Arts and Sports.
- Pilot `scheme_of_work.id`: `c2debb21-8a41-4882-86d5-211c5318ba63`; Week 11, custom source, `curriculum_id = NULL`, `lesson_number = NULL`, `sequence_number = 1`.
- Canonical root/version: `learning_resources` / `learning_resource_versions`; authoritative delivery links: `teaching_resource_links`.
- 33 resources exist in production with `canonical_key LIKE 'vs:g1:jumping:%'`, all `status='inactive'`, `visibility='private'`, `owner_type='platform'`. All 33 versions are `candidate` with rights review pending.
- 14 teacher notes + 14 learner notes; plus teacher guide, assessment rubric, observation record, original song and learner introduction.
- The 28 lesson-specific versions have both lesson content and structured activities. Candidate versions preserve the full original lesson text and a SHA-256 digest of their stored JSON.
- No certification or public release was undertaken.

## Canonical cross-tool contract

| Tool | Canonical content source | Readiness |
| --- | --- | --- |
| Curriculum map | `cbc_strands` and `curriculum_learning_outcomes` | Sub-strand identity exists; reconciliation/verification remains separate |
| Scheme of Work | `scheme_of_work.sub_strand_id` / `scheme_lesson_outcomes` | Pilot linked by sub-strand; not fourteen individually dated lesson rows |
| Teacher Guide / Notes | `learning_resources` + exact `learning_resource_versions` | Private candidates populated |
| Learner Notes / Practice | Same canonical roots/versions, routed through existing learner/resource authority | Candidate data populated; learner delivery not enabled |
| Lesson Plan | `buildCanonicalLessonSourceBundle` and `generateCanonicalLessonPlan` | Consumer requires certified version, active root and a stable `curriculum_id` |
| Assessment / Observation | Canonical rubric + worksheet payloads; assessment engine retains question authority | Review-stage reusable content; no new assessment engine |
| Media / Print | Original local DOCX/PDF editions; no storage URL assumed | Binary uploads and authorised retrieval not yet wired |

## Release blockers (do not bypass)

1. **Educational sign-off:** Subject teacher classroom verification, inclusion/safety review, editorial, curriculum reconciliation and rights/provenance checks required. The draft's own internal editorial record lists these gates.
2. **No fabricated curriculum/week binding:** The current Grade 1 Jumping scheme has no `curriculum_id` or `lesson_number`. `lessonWorkspace` requires a stable curriculum ID for canonical generation. Never invent a term, week, date or lesson number to satisfy this check.
3. **Scoped lesson retrieval:** This branch filters explicit `vs:g1:jumping:*:lesson:NN` keys against only `source.lessonNumber`; unrelated assets are unaffected. `sequence_number` and week are deliberately not treated as lesson number.
4. **Commercial entitlement:** The live `fn_learning_resource_visible` currently admits `platform_authored` only if **public and certified**. Before commercial release, implement and test licensed visibility using existing entitlement/adoption authorities; do not label premium content public just to make it display.
5. **Binary assets:** DOCX/PDF illustrations need secure object upload and authenticated/entitled retrieval, not public GitHub blobs or chat-only sandbox links.
6. **Certification and activation:** Use existing independent verification and platform-owner certification authority, then activate canonical roots through governed promotion. Never force `lifecycle_status='certified'` directly.
7. **End-to-end verification:** Test real teacher scheme→lesson plan, teacher guide/notes, learner notes, observation record, paid entitlement, and unauthorised access. Certify only after exact-head CI, authenticated smoke, and production trace are green.

## Regression test

`npm run test:jumping-content`

Protects explicit lesson-unit matching and the fail-closed case where a scheme has no lesson number. The existing `npm run validate` now includes this test.
