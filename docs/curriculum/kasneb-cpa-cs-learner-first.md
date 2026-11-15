# KASNEB professional courses — learner-first canonical curriculum

Status: **structure staged, content not yet published**. Last checked 2026-11-15.

## Decision

Use VibeSchool's existing `courses -> modules -> topics` academy model for independent learners. Professional qualifications **are not** KICD grades and must not inherit school term/week or teacher-timetable dependencies.

- `courses`: one qualification (CPA, CS), independent of a school/teacher.
- `modules`: KASNEB papers, linked to the course and tagged with the verified qualification level (`Foundation`, `Intermediate`, `Advanced`). Module slugs carry official paper codes (CA11, CS11, etc.).
- `topics`: verified syllabus topics under each paper. Empty until the relevant official full syllabus can be source-checked and mapped. Never publish placeholder topics to disguise missing content.
- Source/version metadata: record URL and verified date with the course; keep detailed topic provenance and outcomes when importing syllabus depth.
- Assessment, progress, mastery, feedback and enrolment: reuse existing canonical learner engines; never clone assessment or curriculum authorities for CPA/CS.
- Teacher features, scheme of work and timetable: **not required** for learners. Later map teacher training onto the same qualified curriculum, rather than copying a parallel syllabus.

## Learner experience contract

College/Professional > Choose CPA or CS > Choose level > Choose paper > Learn topic > Worked examples and practice > Immediate objective marking + guided review for long-form responses > Topic practice / CAT / trial / full mock > Progress and mistake revision.

Learners should be able to begin without class, teacher, college affiliation or approval. Course access/entitlements must obey the canonical account and subscription rules rather than separate academy permissions. Do not change student profiles or enrolments during catalog seeding.

## Source authority and ambiguity

- **Versioned catalogue authority for both CPA and CS:** KASNEB [Qualifications Booklet, April 2026](https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf). Its CPA Advanced paper codes are `CA34`, `CA35S1`, `CA35S2`, `CA35S3`, `CA36P`, `CA37WE`, `CA38WP`.
- **Documented conflict:** the undated [KASNEB CPA web page](https://www.kasneb.or.ke/cpa) currently displays `CA34S3`, `CA34S1`, `CA34S2`, `CA34S4`, `CA35P`, `CA36WE`, `CA37WP` for the respective advanced items. Both are official KASNEB sources. We select the **dated 2026 booklet** for this unlaunched catalogue snapshot and keep the discrepancy explicit until KASNEB confirms the currently examinable codes. **Never represent the conflict as resolved or instruct candidates which advanced paper to book from this catalogue alone.**
- The older detailed [CPA syllabus revised June 2024](https://www.kasneb.or.ke/wp-content/uploads/2024/09/CPA-Syllabus-Reviewed-June-2024.pdf) provides syllabus topics but is a separate version. Reconcile its outcomes and codes before publishing each learner scope; do not pass prior-version material off as a verified 2026 syllabus.
- For CS, the 2026 booklet verifies paper structure including `CS35R1` or `CS35R2`; still obtain the full current CS syllabus (not merely paper titles) before claiming all units/topics/outcomes are covered.
- For CS, obtain the official full syllabus (not merely the qualifications booklet) before claiming all units, topics, outcomes and practice coverage.
- A catalogue paper entry is not a full curriculum: no topic/outcome completeness claim until line-by-line reconciliation. Verify subsequent KASNEB revisions before content production.
- Advanced CPA includes required, specialisation-choice, practical and workshop items; they are not interchangeable. CS advanced has a research-project/workshop alternative. KASNEB institutional/qualification rules are represented as data and must not be treated as a VibeSchool award of qualification.

## Data integrity tests (run after applying migration in a controlled environment)

```sql
select c.slug,c.status,count(m.id) as paper_count,
       count(*) filter (where m.qualification_level='Foundation') as foundation,
       count(*) filter (where m.qualification_level='Intermediate') as intermediate,
       count(*) filter (where m.qualification_level='Advanced') as advanced
from public.courses c
left join public.modules m on m.course_id=c.id
where c.slug in ('kasneb-cpa','kasneb-cs')
group by c.slug,c.status order by c.slug;
-- Expected: kasneb-cpa: coming_soon, 22,6,6,10
-- Expected: kasneb-cs:  coming_soon, 18,6,6,6
```

Additional gates: verify a course survives a repeated import without duplicate papers; no paper becomes published content by seeding; all pre-existing school curriculum rows unchanged; no learner enrollment or RLS changes; empty paper path fails gracefully; official version drift is reconciled before every content publication.

## Delivery steps

1. Merge source-grounded, non-publishing course/paper data migration after exact-head CI and database/security gates.
2. Import CPA Foundation paper-by-paper with validated KASNEB topic/outcome coverage and learner-original explanations, worked examples and questions. Start with CA11 Financial Accounting.
3. Validate learner-only enrolment, topic reading, practice marking and mistake review with a real independent learner account.
4. Run the same import+QA process for intermediate/advanced CPA and CS without duplicating course infrastructure.
5. Only change `coming_soon` to `live` when real learner-visible published content and end-to-end tests pass. Never advertise catalogue-only rows as complete teaching content.

This catalog preserves the KASNEB course inventory. It does **not** yet claim complete, teachable CPA/CS syllabuses.

## Source drift and safety release rule

The verified 2026 booklet and the live CPA webpage disagree about Advanced code IDs. Because paper codes can affect exam registration, keep both courses `coming_soon` and explicitly version the official source used for each paper before learner publication. For Advanced CPA paper-selection advice, require confirmation against KASNEB's current examination registration system or an official dated notice. Changes to source structure require a traceable migration and regression check, not a silent edit of learner progress keys.
