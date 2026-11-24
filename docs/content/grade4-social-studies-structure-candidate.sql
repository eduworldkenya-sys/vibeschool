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
-- This candidate only inserts headings. It makes no RLS, grants, or publication changes.
commit;
