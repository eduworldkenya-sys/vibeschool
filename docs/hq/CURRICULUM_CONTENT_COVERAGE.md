# HQ Curriculum and Content Coverage — Canonical Read Model

**Route:** /hq/studio/coverage (existing HQ authentication and owner access check)
**Source:** public.hq_content_coverage, a restricted, read-only RPC.
**Scope:** Display-only operations; no new content/curriculum tables, no worker, no approval gate, no ingestion pathway.

## Register and hierarchy

- Class options: Playgroup; PP1–PP2; Grades 1–6; Grades 7–9; Grades 10–12; legacy Forms 1–4.
- Canonical subject register: public.grade_subject_authority, effective-date aware. A subject found in curriculum or outcome records but not in the register is shown as **Not registered**, never silently discarded.
- Playgroup is a category in HQ, not a claim that KICD has published a Playgroup subject design. If no register entries are present, show "No subjects registered".
- Early Years, Grades 1–9, Senior School and legacy 8-4-4 must never be merged into one purported KICD edition.
- Subject names and grade labels are compared after whitespace/case normalization only. Curriculum synonyms are **not** automatically treated as equivalent; verify aliases through existing authority before reconciling and changing records.
- A registry entry is not proof of line-by-line KICD source verification. Report the stored source reference separately.

## Counts and progress

The denominator is the distinct, non-archived curriculum_learning_outcomes resolved to a grade and subject through:
1. Existing outcome -> curriculum FK, or
2. Existing outcome -> cbc_strands FK -> subjects FK.

The summary also includes current public.curriculum rows, even where no learning outcomes are linked. Detail shows topic and subtopic rows independently of outcome links. Unlocated outcomes are reported in diagnostics **without** being assigned to arbitrary grades.

Read-only evidence joins:
- Existing learning_resources with exact curriculum_outcome_id, and content_block_outcome_links for authored material.
- Existing assessment_questions with exact learning_outcome_id, platform scope, confirmed status and approved review status.
- Existing outcome_package roots, pinned latest learning_resource_versions and lifecycle. This is **not** a manual checklist.
- The percentage labelled "content recorded" means at least one linked resource or content block per located outcome. It does **not** mean a complete four-part packet.
- The number "certified package" means the latest package version is certified; "core release declared" requires certified version, active/public root and core release field. Neither alone proves a learner can view the package.

No source, authored, certified, released, learner-visible, quality or question-bank state is inferred from a topic title, a GitHub commit, an unverified KICD claim, a candidate asset or a user's manual checkbox.

## Security

The RPC is SECURITY DEFINER solely to read HQ-wide canonical records behind tenant RLS. It invokes the existing hq_assert_owner() guard before accessing them. REVOKE ALL from PUBLIC and anon; GRANT EXECUTE only to authenticated and service_role. HQ Layout independently checks the authenticated HQ session. No raw curriculum authority text or private rights documentation is placed on the public pages.

## Known gaps surfaced, not filled by assertion

- The official subject register must be individually reconciled for every class and pathway. Missing or outdated entries are a **catalogue gap**, not an outcome successfully mapped.
- Legacy Form 1–3 have an incomplete current subject register; no speculative KCSE subject records are inserted by this read-model change.
- Playgroup requires an appropriate early-learning source, not a fabricated KICD subject list.
- Some outcomes do not resolve to either canonical curriculum or cbc_strands grade/subject and are excluded from the denominator, with a visible diagnostic total.
- Several existing authored assets and legacy publications do not carry an exact outcome FK: these remain unmapped to the progress percentage until properly linked; do not infer a match from subject names.
- Source-verified-import counts are conservative. A separate active package reconciliation gate exists and can extend source-verification calculation only after exact mapped evidence is checked.
- A certified package is not proof of teacher/learner experience. Publishing visibility needs reader acceptance evidence.
- No Playgroup-to-Form-4 100% content, source equality, subject roster or public visibility claim is made.

## Tests and acceptance

- Run scripts/sql/hq_content_coverage_verify.sql against a disposable or approved database with the migration installed.
- Assert anon EXECUTE denied, summary results omit detailed outcomes, subject and filtered detail data remain scoped, aggregate numerators never exceed outcome denominators.
- UI: signed-in authorized HQ opens Studio -> Content Coverage; every grade option is available; unregistered grade and subject show honest empty states; a subject drilldown shows individual topics/subtopics and outcomes; refresh reflects data changes without a manual update.
- Test non-HQ role rejection through the existing HQ access/session boundary, as well as mobile layout and failure when migration has not deployed.
- Record the actual production migration and signed-in browser test before claiming LIVE.

**Out of scope:** automatic content generation, content certification, KICD source ingestion, scheme editing, timetable management and publication. Those remain in their existing canonical workflows.
