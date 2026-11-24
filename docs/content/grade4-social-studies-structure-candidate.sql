-- REVIEW CANDIDATE ONLY. Not yet a migration or production authorization.
-- Source headings and locators; no official outcome text is reproduced.
-- Preserve all 39 legacy units and all existing references.
begin;
do $guard$
begin
  if not exists(select 1 from public.subjects where id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and name='Social Studies' and school_id is null and global_subject_id is null) then
    raise exception 'GRADE4_SOCIAL_STUDIES_SUBJECT_MISMATCH';
  end if;
end $guard$;
with proposed(code,strand,heading,printed_page,lesson_count) as (values
('1.1','Natural and built environments','Compass Direction',1,6),
('1.2','Natural and built environments','Location and size of the County',3,5),
('1.3','Natural and built environments','Physical features in the County',5,5),
('1.4','Natural and built environments','Seasons in the County',7,4),
('1.5','Natural and built environments','Historic Built Environments in the County',9,5),
('2.1','People and population','Interdependence of people',12,6),
('2.2','People and population','Population Distribution',14,5),
('3.1','Social organisations','Aspects of Traditional Culture in the County',17,4),
('3.2','Social organisations','The School',19,3),
('4.1','Resources and economic activities','Economic activities in the County',22,4),
('4.2','Resources and economic activities','Industries in the County',24,6),
('4.3','Resources and economic activities','Enterprise Project at School',25,7),
('5.1','Citizenship and governance in Kenya','Good Citizenship in School',28,4),
('5.2','Citizenship and governance in Kenya','Peace',30,4),
('5.3','Citizenship and governance in Kenya','Child Rights',32,4),
('5.4','Citizenship and governance in Kenya','Democracy in school',35,3),
('5.5','Citizenship and governance in Kenya','Children’s Government in school',37,4),
('5.6','Citizenship and governance in Kenya','Community Leadership',39,5),
('5.7','Citizenship and governance in Kenya','The County Governments in Kenya',41,6)
)
insert into public.cbc_strands(subject_id,grade,name,sub_strand,strand_order,sub_strand_order,source_ref)
select '09715a10-3f91-4351-b6bc-fa252666a20b'::uuid,'Grade 4',strand,code||' '||heading,split_part(code,'.',1)::integer,split_part(code,'.',2)::integer,
       'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf'||'#page='||(printed_page+12)::text||'&unit='||code
from proposed
on conflict(subject_id,grade,name,sub_strand) do nothing;
do $guard$
declare n integer;
begin
 select count(*) into n from public.cbc_strands where subject_id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and grade='Grade 4' and source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit=%';
 if n<>19 then raise exception 'GRADE4_SOCIAL_STUDIES_EXPECTED_19_GOT_%',n; end if;
end $guard$;
-- Official outcome records must be admitted through the existing source/authority workflow.
-- Never promote the authored scheme draft to official outcomes.
-- This candidate only inserts headings. It does not alter existing RLS or publishing; the new invoker RPC is authenticated-only and delegates existing tenant checks.
-- Same tenant-checked planning contract as Grade 5 CRE. No official outcome is invented.
create or replace function public.commit_grade4_social_studies_scheme_unit(
 p_class_id uuid,p_subject_id uuid,p_academic_term_id uuid,p_week integer,p_sub_strand_id uuid,p_outcome_ids uuid[] default '{}'::uuid[]
) returns public.scheme_of_work language plpgsql security invoker set search_path='' as $fn$
declare
 v_unit public.cbc_strands%rowtype;
 v_global_subject uuid;
 v_count integer;
 v_distinct integer;
 v_objectives text;
 v_scheme public.scheme_of_work%rowtype;
 v_saved public.scheme_of_work%rowtype;
begin
 if auth.uid() is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
 if p_outcome_ids is null or cardinality(p_outcome_ids)>12 then raise exception 'SCHEME_OUTCOME_SELECTION_INVALID'; end if;
 select count(distinct x) into v_distinct from unnest(p_outcome_ids) x;
 if v_distinct is distinct from cardinality(p_outcome_ids) then raise exception 'SCHEME_DUPLICATE_OUTCOMES'; end if;
 select g.id into v_global_subject from public.subjects s join public.subjects g on g.id=case when s.school_id is null then s.id else s.global_subject_id end
 where s.id=p_subject_id and g.id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and g.name='Social Studies' and g.school_id is null and g.global_subject_id is null;
 if v_global_subject is null then raise exception 'SCHEME_SUBJECT_IDENTITY_MISMATCH'; end if;
 select * into v_unit from public.cbc_strands c where c.id=p_sub_strand_id and c.subject_id=v_global_subject and c.grade='Grade 4' and c.term is null and c.week is null and c.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit=%';
 if v_unit.id is null then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;
 if not exists(select 1 from public.classes c where c.id=p_class_id and lower(btrim(c.name)) ~ '^(grade|class)[[:space:]]*4([[:space:]]|$)') then raise exception 'SCHEME_GRADE_MISMATCH'; end if;
 select count(*),string_agg(o.outcome_text,E'\n' order by array_position(p_outcome_ids,o.id)) into v_count,v_objectives
 from public.curriculum_learning_outcomes o where o.id=any(p_outcome_ids) and o.sub_strand_id=v_unit.id and o.status='active' and o.source_type='official' and o.created_by is null and o.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%';
 if v_count is distinct from cardinality(p_outcome_ids) then raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH'; end if;
 v_scheme:=public.commit_custom_scheme_item(p_class_id,p_subject_id,p_academic_term_id,p_week,v_unit.sub_strand,v_unit.name,null,null);
 update public.scheme_of_work set sub_strand_id=v_unit.id,sub_strand=v_unit.sub_strand,objectives=v_objectives,curriculum_outcome_id=case when v_count>0 then p_outcome_ids[1] else null end,reference=v_unit.source_ref||' (planning reference; outcome equivalence not certified)' where id=v_scheme.id and teacher_id=auth.uid() returning * into v_saved;
 if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;
 insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id) select v_saved.id,unnest(p_outcome_ids);
 return v_saved;
end $fn$;
revoke all on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) from public;
grant execute on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
commit;
