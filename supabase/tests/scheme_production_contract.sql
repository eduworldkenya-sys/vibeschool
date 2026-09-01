-- VibeSchool Scheme production contract
-- Read-only invariant suite. Any returned row is a defect requiring classification/repair.

-- 1. Curriculum-backed Scheme rows must retain canonical identities and planning snapshot.
select
  'curriculum_identity_or_snapshot_incomplete' as defect,
  s.id,
  s.school_id,
  s.class_id,
  s.subject_id,
  s.academic_term_id,
  s.curriculum_id,
  s.curriculum_content_id
from public.scheme_of_work s
where s.source = 'curriculum'
  and (
    s.academic_term_id is null
    or s.curriculum_id is null
    or s.curriculum_content_id is null
    or nullif(btrim(coalesce(s.objectives, '')), '') is null
    or nullif(btrim(coalesce(s.key_inquiry_question, '')), '') is null
    or nullif(btrim(coalesce(s.learning_experiences, '')), '') is null
    or nullif(btrim(coalesce(s.learning_resources, '')), '') is null
    or nullif(btrim(coalesce(s.assessment_methods, '')), '') is null
  );

-- 2. No duplicate authoritative curriculum occurrence within class/subject/term.
select
  'duplicate_curriculum_occurrence' as defect,
  s.school_id,
  s.class_id,
  s.subject_id,
  s.academic_term_id,
  s.curriculum_id,
  count(*) as duplicate_count
from public.scheme_of_work s
where s.source = 'curriculum'
group by s.school_id, s.class_id, s.subject_id, s.academic_term_id, s.curriculum_id
having count(*) > 1;

-- 3. Sequence identity must be unique inside the authoritative planning scope.
select
  'duplicate_sequence' as defect,
  s.school_id,
  s.class_id,
  s.subject_id,
  s.academic_term_id,
  s.sequence_number,
  count(*) as duplicate_count
from public.scheme_of_work s
where s.sequence_number is not null
group by s.school_id, s.class_id, s.subject_id, s.academic_term_id, s.sequence_number
having count(*) > 1;

-- 4. School/class ownership must agree.
select
  'class_cross_tenant' as defect,
  s.id,
  s.school_id as scheme_school_id,
  c.school_id as class_school_id
from public.scheme_of_work s
join public.classes c on c.id = s.class_id
where c.school_id is distinct from s.school_id;

-- 5. Academic term must belong to the same school when present.
select
  'term_cross_tenant' as defect,
  s.id,
  s.school_id as scheme_school_id,
  at.school_id as term_school_id
from public.scheme_of_work s
join public.academic_terms at on at.id = s.academic_term_id
where at.school_id is distinct from s.school_id;

-- 6. Curriculum identity must resolve to the same canonical subject/grade/term.
select
  'curriculum_identity_mismatch' as defect,
  s.id,
  s.curriculum_id,
  s.grade as scheme_grade,
  c.grade as curriculum_grade,
  s.term as scheme_term,
  c.term as curriculum_term
from public.scheme_of_work s
join public.curriculum c on c.id = s.curriculum_id
where s.source = 'curriculum'
  and (s.grade is distinct from c.grade or s.term is distinct from c.term);

-- 7. Status vocabulary is closed.
select 'invalid_status' as defect, s.id, s.status
from public.scheme_of_work s
where s.status not in ('planned', 'teaching', 'done', 'cancelled');

-- 8. Legacy rows missing term identity are never silently repaired by this contract.
-- They are surfaced for deterministic classification or explicit human review.
select
  'missing_term_requires_classification' as defect,
  s.id,
  s.source,
  s.week,
  s.topic,
  s.curriculum_id,
  s.curriculum_content_id
from public.scheme_of_work s
where s.academic_term_id is null;
