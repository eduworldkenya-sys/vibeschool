-- Grade 8 English — read-only canonical Curriculum Map → Scheme of Work preflight.
-- KICD revised 2024 Grade 8 English, published source:
-- https://kicd.ac.ke/wp-content/uploads/2024/06/English-Grade-8-Design-Formatted-April-2024.pdf
-- Factual source summary: 15 themes; 5 indexed planning units/theme (Listening and
-- Speaking, Reading 1, Reading 2, Grammar in Use, Writing); 150 suggested lessons.
-- The 150 currently stored VibeSchool outcomes are ORIGINAL; do not count them as
-- source-exact KICD requirements. This query does not register or publish a source.
-- Never delete legacy rows or create teacher-owned Scheme entries through this audit.

with expected as (
 select lpad(n::text,2,'0')||'-'||v.suffix as unit_key,n as theme,v.strand
 from generate_series(1,15) n
 cross join (values
  ('LS','Listening and Speaking'),
  ('RC','Reading'),
  ('RL','Reading'),
  ('GR','Grammar in Use'),
  ('WR','Writing')
 ) as v(suffix,strand)
), mapped as (
 select e.*,b.sub_strand_id,s.subject_id,s.grade,s.name,s.source_ref,
  g.suggested_lessons,
  (select count(*) from public.curriculum_learning_outcomes o
   where o.sub_strand_id=b.sub_strand_id and o.source_type='creator_claimed'
     and o.status='active' and o.source_ref like b.source_ref||'/%') original_outcome_rows,
  (select count(*) from public.curriculum_learning_outcomes o
   where o.sub_strand_id=b.sub_strand_id and o.verified_at is not null
     and o.status='verified') source_verified_outcomes,
  (select count(*) from public.scheme_of_work w where w.sub_strand_id=b.sub_strand_id) saved_schemes
 from expected e
 left join public.grade8_english_reader_bindings b
   on b.source_ref='VS-CUR-G08-EN-2026#'||e.unit_key and b.status='active'
 left join public.cbc_strands s on s.id=b.sub_strand_id
 left join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id
)
select theme,unit_key,strand,
 case when sub_strand_id is null then 'READER_MISSING'
   when grade is distinct from 'Grade 8' or name is distinct from strand then 'CURRICULUM_IDENTITY_CONFLICT'
   when suggested_lessons is distinct from 2 then 'LESSON_ALLOCATION_CONFLICT'
   when original_outcome_rows is distinct from 2 then 'VIBESCHOOL_OUTCOME_COVERAGE_CONFLICT'
   else 'STRUCTURE_MATCHED' end structural_state,
 case when source_ref is null then 'SUBSTRAND_SOURCE_REF_MISSING'
   when source_ref='VS-CUR-G08-EN-2026#'||unit_key then 'SUBSTRAND_SOURCE_REF_MATCH'
   else 'SUBSTRAND_SOURCE_REF_CONFLICT' end source_reference_state,
 original_outcome_rows,source_verified_outcomes,saved_schemes
from mapped
order by theme,unit_key;

-- Source verification, official outcome transcription and authenticated teacher
-- save/readback are separate gates. The total below must not certify them.
select
 (select count(*) from public.grade8_english_reader_bindings where status='active') active_reader_units,
 (select count(*) from public.curriculum_authority_sources a
  where a.grade='Grade 8' and a.subject_label ilike '%english%') registered_authority_sources,
 (select count(*) from public.scheme_of_work w
  where w.grade='Grade 8' and lower(w.subject) like '%english%') saved_grade8_english_schemes;
