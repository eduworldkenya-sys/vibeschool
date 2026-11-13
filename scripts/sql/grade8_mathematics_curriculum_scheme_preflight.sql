-- Grade 8 Mathematics: source-hierarchy and canonical Scheme preflight (READ ONLY).
-- Reference: KICD Junior School Mathematics Grade 8, revised 2024, printed summary p. x:
-- https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-8-Design-Formatted-April-2024.pdf
-- This checks *factual headings and suggested lessons*, not word-for-word transcription
-- or the source-certification status of independently authored VibeSchool outcomes.
-- Do not update, delete or insert curriculum, teacher, school or scheme records here.
-- Governed mission: https://github.com/eduworldkenya-sys/vibeschool/issues/1528

with expected(code,strand,sub_strand,suggested_lessons) as (
 values
 ('1.1','Numbers','Integers',6),
 ('1.2','Numbers','Fractions',6),
 ('1.3','Numbers','Decimals',8),
 ('1.4','Numbers','Squares and Square Roots',6),
 ('1.5','Numbers','Rates, Ratio, Proportions and Percentages',14),
 ('2.1','Algebra','Algebraic Expressions',6),
 ('2.2','Algebra','Linear Equations',7),
 ('3.1','Measurements','Circles',5),
 ('3.2','Measurements','Area',10),
 ('3.3','Measurements','Money',9),
 ('4.1','Geometry','Geometrical Constructions',12),
 ('4.2','Geometry','Coordinates and Graphs',14),
 ('4.3','Geometry','Scale Drawing',14),
 ('4.4','Geometry','Common Solids',16),
 ('5.1','Data Handling and Probability','Data Presentation and Interpretation',10),
 ('5.2','Data Handling and Probability','Probability',7)
)
select e.code,e.strand,e.sub_strand,e.suggested_lessons,
 case when b.sub_strand_id is null then 'READER_MISSING'
      when s.id is null then 'CANONICAL_SUBSTRAND_MISSING'
      when s.grade<>'Grade 8' or s.name<>e.strand or s.sub_strand<>e.sub_strand then 'STRUCTURE_CONFLICT'
      when g.sub_strand_id is null or g.suggested_lessons is distinct from e.suggested_lessons then 'LESSON_ALLOCATION_CONFLICT'
      else 'STRUCTURE_MATCHED' end structural_state,
 case when s.source_ref is null then 'STRAND_SOURCE_REF_MISSING'
      when s.source_ref=b.source_ref then 'STRAND_SOURCE_REF_MATCH'
      else 'STRAND_SOURCE_REF_CONFLICT' end strand_source_state,
 (select count(*) from public.curriculum_learning_outcomes o where o.sub_strand_id=s.id) authored_outcome_rows,
 (select count(*) from public.curriculum_learning_outcomes o where o.sub_strand_id=s.id
    and o.verified_at is not null and o.status='verified') source_verified_outcome_rows,
 (select count(*) from public.scheme_of_work w where w.sub_strand_id=s.id) saved_scheme_rows
from expected e
left join public.grade8_mathematics_reader_bindings b
  on b.source_ref='VS-CUR-G08-MA-2026#'||e.code and b.status='active'
left join public.cbc_strands s on s.id=b.sub_strand_id
left join public.curriculum_unit_guidance g on g.sub_strand_id=s.id
order by split_part(e.code,'.',1)::int,split_part(e.code,'.',2)::int;

-- Counts below are visibility checks, not evidence of source-exact matches.
select
 (select count(*) from public.grade8_mathematics_reader_bindings b
  join public.cbc_strands s on s.id=b.sub_strand_id
  where b.status='active' and s.grade='Grade 8') as active_reader_sub_strands,
 (select count(*) from public.curriculum_authority_sources a
  where a.grade='Grade 8' and a.subject_label ilike '%math%') as registered_kicd_authority_sources,
 (select count(*) from public.scheme_of_work w
  where w.grade='Grade 8' and lower(w.subject) like '%math%') as saved_grade8_mathematics_schemes;
