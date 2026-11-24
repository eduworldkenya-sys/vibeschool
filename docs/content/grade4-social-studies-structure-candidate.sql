-- REVIEW CANDIDATE ONLY. Not yet a migration or production authorization.
-- Source headings and user-supplied verbatim outcome text. Not certified as official database authority.
-- Preserve all 39 legacy units and all existing references.
begin;
do $guard$
begin
  if not exists(select 1 from public.subjects where id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and name='Social Studies' and school_id is null and global_subject_id is null) then
    raise exception 'GRADE4_SOCIAL_STUDIES_SUBJECT_MISMATCH';
  end if;
end;
$guard$;
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
end;
$guard$;
-- User-supplied source transcript, not an official authority promotion.
-- Store as publisher reference (the established Grade 4 CRE pattern), never as verified/official.
with proposed(code,unit_code,outcome_text,source_ref) as (values
('1.1.a','1.1','identify the four cardinal points of a compass','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=13&unit=1.1&outcome=1.1.a&provenance=user-transcript-2026-11-24'),
('1.1.b','1.1','use the four cardinal points to give directions on a map','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=13&unit=1.1&outcome=1.1.b&provenance=user-transcript-2026-11-24'),
('1.1.c','1.1','appreciate the use of four cardinal points in everyday life','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=13&unit=1.1&outcome=1.1.c&provenance=user-transcript-2026-11-24'),
('1.2.a','1.2','identify sub-counties in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=15&unit=1.2&outcome=1.2.a&provenance=user-transcript-2026-11-24'),
('1.2.b','1.2','locate the county in relation to neighbouring counties','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=15&unit=1.2&outcome=1.2.b&provenance=user-transcript-2026-11-24'),
('1.2.c','1.2','estimate the size of the county in relation to neighbouring counties','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=15&unit=1.2&outcome=1.2.c&provenance=user-transcript-2026-11-24'),
('1.2.d','1.2','acknowledge the location and size of the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=15&unit=1.2&outcome=1.2.d&provenance=user-transcript-2026-11-24'),
('1.3.a','1.3','identify the main physical features in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=17&unit=1.3&outcome=1.3.a&provenance=user-transcript-2026-11-24'),
('1.3.b','1.3','state the importance of the main physical features in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=17&unit=1.3&outcome=1.3.b&provenance=user-transcript-2026-11-24'),
('1.3.c','1.3','illustrate the main physical features in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=17&unit=1.3&outcome=1.3.c&provenance=user-transcript-2026-11-24'),
('1.3.d','1.3','appreciate the main physical features in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=17&unit=1.3&outcome=1.3.d&provenance=user-transcript-2026-11-24'),
('1.4.a','1.4','identify the four seasons experienced in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=19&unit=1.4&outcome=1.4.a&provenance=user-transcript-2026-11-24'),
('1.4.b','1.4','explain how the four seasons influence human activities in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=19&unit=1.4&outcome=1.4.b&provenance=user-transcript-2026-11-24'),
('1.4.c','1.4','explore how rainy weather affects road safety in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=19&unit=1.4&outcome=1.4.c&provenance=user-transcript-2026-11-24'),
('1.4.d','1.4','model weather charts of seasons in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=19&unit=1.4&outcome=1.4.d&provenance=user-transcript-2026-11-24'),
('1.4.e','1.4','appreciate the different seasons experienced in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=19&unit=1.4&outcome=1.4.e&provenance=user-transcript-2026-11-24'),
('1.5.a','1.5','identify the main historic built environments in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=21&unit=1.5&outcome=1.5.a&provenance=user-transcript-2026-11-24'),
('1.5.b','1.5','explain the importance of the main historic built environments in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=21&unit=1.5&outcome=1.5.b&provenance=user-transcript-2026-11-24'),
('1.5.c','1.5','participate in conservation activities of the historic built environments within the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=21&unit=1.5&outcome=1.5.c&provenance=user-transcript-2026-11-24'),
('1.5.d','1.5','appreciate historic built environments in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=21&unit=1.5&outcome=1.5.d&provenance=user-transcript-2026-11-24'),
('2.1.a','2.1','identify ways in which people depend on each other in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=24&unit=2.1&outcome=2.1.a&provenance=user-transcript-2026-11-24'),
('2.1.b','2.1','explain the benefits of interdependence of people in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=24&unit=2.1&outcome=2.1.b&provenance=user-transcript-2026-11-24'),
('2.1.c','2.1','use chart to illustrate the benefits of interdependence people','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=24&unit=2.1&outcome=2.1.c&provenance=user-transcript-2026-11-24'),
('2.1.d','2.1','appreciate the interdependence of people in the County','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=24&unit=2.1&outcome=2.1.d&provenance=user-transcript-2026-11-24'),
('2.2.a','2.2','describe patterns of population distribution in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=26&unit=2.2&outcome=2.2.a&provenance=user-transcript-2026-11-24'),
('2.2.b','2.2','illustrate the patterns of population distribution in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=26&unit=2.2&outcome=2.2.b&provenance=user-transcript-2026-11-24'),
('2.2.c','2.2','appreciate population distribution in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=26&unit=2.2&outcome=2.2.c&provenance=user-transcript-2026-11-24'),
('3.1.a','3.1','identify aspects of traditional culture in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=29&unit=3.1&outcome=3.1.a&provenance=user-transcript-2026-11-24'),
('3.1.b','3.1','illustrate aspects of traditional culture practised in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=29&unit=3.1&outcome=3.1.b&provenance=user-transcript-2026-11-24'),
('3.1.c','3.1','appreciate the importance of traditional culture in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=29&unit=3.1&outcome=3.1.c&provenance=user-transcript-2026-11-24'),
('3.2.a','3.2','narrate the history of the school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=31&unit=3.2&outcome=3.2.a&provenance=user-transcript-2026-11-24'),
('3.2.b','3.2','explain the values of the school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=31&unit=3.2&outcome=3.2.b&provenance=user-transcript-2026-11-24'),
('3.2.c','3.2','recite the school motto','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=31&unit=3.2&outcome=3.2.c&provenance=user-transcript-2026-11-24'),
('3.2.d','3.2','desire to obey the school rules','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=31&unit=3.2&outcome=3.2.d&provenance=user-transcript-2026-11-24'),
('4.1.a','4.1','Explore the main resources found in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=34&unit=4.1&outcome=4.1.a&provenance=user-transcript-2026-11-24'),
('4.1.b','4.1','identify the main economic activities carried out in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=34&unit=4.1&outcome=4.1.b&provenance=user-transcript-2026-11-24'),
('4.1.c','4.1','explain the importance of economic activities carried out in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=34&unit=4.1&outcome=4.1.c&provenance=user-transcript-2026-11-24'),
('4.1.d','4.1','participate in economic activities in the locality','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=34&unit=4.1&outcome=4.1.d&provenance=user-transcript-2026-11-24'),
('4.1.e','4.1','appreciate the economic activities in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=34&unit=4.1&outcome=4.1.e&provenance=user-transcript-2026-11-24'),
('4.2.a','4.2','identify industries in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=36&unit=4.2&outcome=4.2.a&provenance=user-transcript-2026-11-24'),
('4.2.b','4.2','explain the benefits of industries in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=36&unit=4.2&outcome=4.2.b&provenance=user-transcript-2026-11-24'),
('4.2.c','4.2','locate industries in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=36&unit=4.2&outcome=4.2.c&provenance=user-transcript-2026-11-24'),
('4.2.d','4.2','recognise the role of industries in the county','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=36&unit=4.2&outcome=4.2.d&provenance=user-transcript-2026-11-24'),
('4.3.a','4.3','identify the projects that can be initiated at school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=37&unit=4.3&outcome=4.3.a&provenance=user-transcript-2026-11-24'),
('4.3.b','4.3','participate in initiating an enterprise project at school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=37&unit=4.3&outcome=4.3.b&provenance=user-transcript-2026-11-24'),
('4.3.c','4.3','uphold ethics and collective efforts in managing enterprise projects at school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=37&unit=4.3&outcome=4.3.c&provenance=user-transcript-2026-11-24'),
('5.1.a','5.1','identify qualities of a good citizen in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=40&unit=5.1&outcome=5.1.a&provenance=user-transcript-2026-11-24'),
('5.1.b','5.1','develop qualities of good citizenship in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=40&unit=5.1&outcome=5.1.b&provenance=user-transcript-2026-11-24'),
('5.1.c','5.1','appreciate qualities of good citizenship in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=40&unit=5.1&outcome=5.1.c&provenance=user-transcript-2026-11-24'),
('5.2.a','5.2','identify factors that promote peace in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=42&unit=5.2&outcome=5.2.a&provenance=user-transcript-2026-11-24'),
('5.2.b','5.2','develop strategies of living in peace with others in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=42&unit=5.2&outcome=5.2.b&provenance=user-transcript-2026-11-24'),
('5.2.c','5.2','desire to uphold peace in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=42&unit=5.2&outcome=5.2.c&provenance=user-transcript-2026-11-24'),
('5.3.a','5.3','outline forms of child abuse in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=44&unit=5.3&outcome=5.3.a&provenance=user-transcript-2026-11-24'),
('5.3.b','5.3','explain the causes of child abuse in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=44&unit=5.3&outcome=5.3.b&provenance=user-transcript-2026-11-24'),
('5.3.c','5.3','explain effects of child abuse in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=44&unit=5.3&outcome=5.3.c&provenance=user-transcript-2026-11-24'),
('5.3.d','5.3','desire to promote child rights and responsibilities in the school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=44&unit=5.3&outcome=5.3.d&provenance=user-transcript-2026-11-24'),
('5.4.a','5.4','identify democratic processes in the school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=47&unit=5.4&outcome=5.4.a&provenance=user-transcript-2026-11-24'),
('5.4.b','5.4','explain the benefits of democracy in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=47&unit=5.4&outcome=5.4.b&provenance=user-transcript-2026-11-24'),
('5.4.c','5.4','practise democratic elements in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=47&unit=5.4&outcome=5.4.c&provenance=user-transcript-2026-11-24'),
('5.4.d','5.4','appreciate democratic practices in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=47&unit=5.4&outcome=5.4.d&provenance=user-transcript-2026-11-24'),
('5.5.a','5.5','explain the composition of Children’s Government in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=49&unit=5.5&outcome=5.5.a&provenance=user-transcript-2026-11-24'),
('5.5.b','5.5','describe the functions of the Children’s Government in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=49&unit=5.5&outcome=5.5.b&provenance=user-transcript-2026-11-24'),
('5.5.c','5.5','participate in Children’s Government in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=49&unit=5.5&outcome=5.5.c&provenance=user-transcript-2026-11-24'),
('5.5.d','5.5','respect Children’s Government in school','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=49&unit=5.5&outcome=5.5.d&provenance=user-transcript-2026-11-24'),
('5.6.a','5.6','identify leaders in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=51&unit=5.6&outcome=5.6.a&provenance=user-transcript-2026-11-24'),
('5.6.b','5.6','explain the duties of leaders in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=51&unit=5.6&outcome=5.6.b&provenance=user-transcript-2026-11-24'),
('5.6.c','5.6','demonstrate qualities of good leadership in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=51&unit=5.6&outcome=5.6.c&provenance=user-transcript-2026-11-24'),
('5.6.d','5.6','appreciate good leadership in the community','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=51&unit=5.6&outcome=5.6.d&provenance=user-transcript-2026-11-24'),
('5.7.a','5.7','identify the structure of county government','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=53&unit=5.7&outcome=5.7.a&provenance=user-transcript-2026-11-24'),
('5.7.b','5.7','explain the duties of County Governor in Kenya','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=53&unit=5.7&outcome=5.7.b&provenance=user-transcript-2026-11-24'),
('5.7.c','5.7','explain the roles of a member of county assembly','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=53&unit=5.7&outcome=5.7.c&provenance=user-transcript-2026-11-24'),
('5.7.d','5.7','appreciate the County Government in Kenya','https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=53&unit=5.7&outcome=5.7.d&provenance=user-transcript-2026-11-24')
)
insert into public.curriculum_learning_outcomes(sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status,created_by)
select c.id,p.outcome_text,p.code,'publisher',p.source_ref,'active',null
from proposed p join public.cbc_strands c
 on c.subject_id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and c.grade='Grade 4'
 and c.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit='||p.unit_code
where not exists(select 1 from public.curriculum_learning_outcomes o where o.sub_strand_id=c.id and o.source_ref=p.source_ref and o.outcome_code=p.code and o.source_type='publisher' and o.outcome_text=p.outcome_text)
on conflict do nothing;
do $guard$
declare n integer; u integer; distinct_codes integer;
begin
 select count(*),count(distinct o.sub_strand_id),count(distinct o.outcome_code) into n,u,distinct_codes
 from public.curriculum_learning_outcomes o join public.cbc_strands c on c.id=o.sub_strand_id
 where c.subject_id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and c.grade='Grade 4'
 and c.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit=%'
 and o.source_type='publisher' and o.status='active' and o.created_by is null
 and o.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&outcome=%&provenance=user-transcript-2026-11-24';
 if n<>72 or u<>19 or distinct_codes<>72 then raise exception 'GRADE4_SOCIAL_STUDIES_REFERENCE_COVERAGE_MISMATCH'; end if;
end;
$guard$;
drop policy if exists grade4_social_studies_reference_outcomes_read on public.curriculum_learning_outcomes;
create policy grade4_social_studies_reference_outcomes_read on public.curriculum_learning_outcomes
for select to authenticated using (
 status='active' and source_type='publisher' and created_by is null
 and source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&outcome=%&provenance=user-transcript-2026-11-24'
 and exists(select 1 from public.cbc_strands c where c.id=curriculum_learning_outcomes.sub_strand_id
   and c.subject_id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and c.grade='Grade 4'
   and c.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit=%')
);
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
 if p_outcome_ids is null or cardinality(p_outcome_ids) not between 1 and 12 then raise exception 'SCHEME_OUTCOME_SELECTION_INVALID'; end if;
 select count(distinct x) into v_distinct from unnest(p_outcome_ids) x;
 if v_distinct is distinct from cardinality(p_outcome_ids) then raise exception 'SCHEME_DUPLICATE_OUTCOMES'; end if;
 select g.id into v_global_subject from public.subjects s join public.subjects g on g.id=case when s.school_id is null then s.id else s.global_subject_id end
 where s.id=p_subject_id and g.id='09715a10-3f91-4351-b6bc-fa252666a20b'::uuid and g.name='Social Studies' and g.school_id is null and g.global_subject_id is null;
 if v_global_subject is null then raise exception 'SCHEME_SUBJECT_IDENTITY_MISMATCH'; end if;
 select * into v_unit from public.cbc_strands c where c.id=p_sub_strand_id and c.subject_id=v_global_subject and c.grade='Grade 4' and c.term is null and c.week is null and c.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&unit=%';
 if v_unit.id is null then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;
 if not exists(select 1 from public.classes c where c.id=p_class_id and lower(btrim(c.name)) ~ '^(grade|class)[[:space:]]*4([[:space:]]|$)') then raise exception 'SCHEME_GRADE_MISMATCH'; end if;
 select count(*),string_agg(o.outcome_text,E'\n' order by array_position(p_outcome_ids,o.id)) into v_count,v_objectives
 from public.curriculum_learning_outcomes o where o.id=any(p_outcome_ids) and o.sub_strand_id=v_unit.id and o.status='active' and o.source_type='publisher' and o.created_by is null and o.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&outcome=%&provenance=user-transcript-2026-11-24';
 if v_count is distinct from cardinality(p_outcome_ids) then raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH'; end if;
 v_scheme:=public.commit_custom_scheme_item(p_class_id,p_subject_id,p_academic_term_id,p_week,v_unit.sub_strand,v_unit.name,null,null);
 update public.scheme_of_work set sub_strand_id=v_unit.id,sub_strand=v_unit.sub_strand,objectives=null,curriculum_outcome_id=case when v_count>0 then p_outcome_ids[1] else null end,reference=v_unit.source_ref||' (user-supplied KICD text; original teacher objectives to be entered; independent verification pending)' where id=v_scheme.id and teacher_id=auth.uid() returning * into v_saved;
 if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;
 insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id) select v_saved.id,unnest(p_outcome_ids);
 return v_saved;
end;
$fn$;
revoke all on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) from public;
grant execute on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
commit;
