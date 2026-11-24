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
 p_class_id uuid,p_subject_id uuid,p_academic_term_id uuid,p_week integer,p_sub_strand_id uuid,p_outcome_ids uuid[],p_lesson_sequence integer
) returns public.scheme_of_work language plpgsql security invoker set search_path='' as $fn$
declare
 v_unit public.cbc_strands%rowtype;
 v_global_subject uuid;
 v_count integer;
 v_distinct integer;
 v_objectives text;
 v_plan record;
 v_selected_codes text[];
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
 select * into v_plan from (values
(1,'1.1','Meet the compass','Label a blank compass with N, E, S and W','Make a paper compass and compare it with a classroom compass','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.a']::text[]),
(2,'1.1','Facing different ways','Find the other three directions when north is marked','Turn a paper arrow on a floor grid','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.a']::text[]),
(3,'1.1','Reading a simple map','Describe where three landmarks lie from a marked point','Use a fictional village map','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.b']::text[]),
(4,'1.1','Giving clear directions','Guide a partner through two map steps','Exchange directions on a drawn grid','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.b']::text[]),
(5,'1.1','Planning a safe route','Choose a route between two places and describe its direction','Compare routes on a school map without leaving the classroom','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.b']::text[]),
(6,'1.1','Compass challenge','Solve new direction problems and explain how a compass can help during a journey','Complete a map puzzle and write a travel example','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.1.c']::text[]),
(7,'1.2','Sub-counties','Find and name the sub-counties on a current approved map of the learner''s county','Annotate a printed county map','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.2.a']::text[]),
(8,'1.2','Counties next door','Name neighbouring counties using the map legend','Trace shared boundaries with coloured pencils','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.2.b']::text[]),
(9,'1.2','Where is our county?','Describe the position of two neighbours relative to the county','Use a north arrow on an outline map','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.2.b']::text[]),
(10,'1.2','Comparing county sizes','Make and explain a reasonable area comparison on same-scale maps','Compare outline shapes on squared paper','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.2.c']::text[]),
(11,'1.2','County map exhibition','Present a sketch with the county name, neighbours and a direction arrow','Peer-check maps against a reference','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.2.d']::text[]),
(12,'1.3','Reading the landscape','Distinguish hills, plains, rivers and other locally relevant features','Sort local landscape pictures','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.3.a']::text[]),
(13,'1.3','Investigating local features','Locate examples of two features on an approved local map','Mark locations using symbols','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.3.a']::text[]),
(14,'1.3','Why landscapes matter','Connect a feature to a possible community benefit','Discuss water, farming or transport examples','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.3.b']::text[]),
(15,'1.3','Making a landscape model','Create a labelled drawing or model of a nearby feature','Use recycled paper and safe modelling materials','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.3.c']::text[]),
(16,'1.3','Our landscape gallery','Explain two local features and ways to value them','Present a drawing with a spoken caption','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.3.d']::text[]),
(17,'1.4','Weather through the year','Recognise hot, cold, dry and rainy conditions using observations','Sort fictional weather records','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.4.a']::text[]),
(18,'1.4','Changing daily routines','Explain how weather changes clothing, farming and travel','Compare two illustrated family days','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.4.b']::text[]),
(19,'1.4','Safe travel in rain','Choose safer actions for wet roads and flooded paths','Evaluate illustrated road-safety situations','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.4.c']::text[]),
(20,'1.4','Recording weather','Create a chart of the county''s weather conditions and describe a useful feature of each season','Use a safe weather log and compare entries','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.4.d','1.4.e']::text[]),
(21,'1.5','Places that tell our story','Recognise a museum, monument and cultural centre from examples','Sort photographs with captions','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.5.a']::text[]),
(22,'1.5','Investigating local heritage','Find a local historic place using a trusted reference','Make a short fact card','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.5.a']::text[]),
(23,'1.5','Why preserve history?','Explain how a historic place helps people learn about the past','Compare an old and a recent picture','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.5.b']::text[]),
(24,'1.5','Caring for heritage','Take part in a safe, adult-supervised action that protects a local heritage place or its learning display','Plan with the teacher and carry out an approved tidy-up or awareness activity','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.5.c']::text[]),
(25,'1.5','Heritage showcase','Explain a local site''s importance and one conservation action','Create a small heritage exhibit; any visit requires adult supervision','Check the learner''s completed task against the stated objective; provide specific feedback.',array['1.5.d']::text[]),
(26,'2.1','From farm to kitchen','Trace the people involved in bringing food to a home','Build a picture chain','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.a']::text[]),
(27,'2.1','Goods and services','Match community jobs to needs they help meet','Sort shop, clinic and transport scenarios','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.a']::text[]),
(28,'2.1','Community support','Describe a helpful role played by local community institutions','Discuss fictional neighbourhood examples','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.a']::text[]),
(29,'2.1','When a link is missing','Predict what happens when one service in a chain stops','Solve a group story problem','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.b']::text[]),
(30,'2.1','Connections chart','Show how community cooperation improves daily life using a diagram','Draw links among farmers, traders, health workers and other local services','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.c']::text[]),
(31,'2.1','Working together','Explain how cooperation benefits a community','Complete a paired problem-solving task','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.1.b','2.1.d']::text[]),
(32,'2.2','Counting people in places','Explain the difference between how many people live somewhere and where they live','Compare fictional village diagrams','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.2.a']::text[]),
(33,'2.2','Crowded and less crowded areas','Describe differences in settlement density using dot maps','Count symbols in equal-size squares','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.2.a']::text[]),
(34,'2.2','Patterns on a map','Distinguish clustered, scattered and line-shaped settlements','Sort three invented map patterns','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.2.a']::text[]),
(35,'2.2','Why people settle differently','Suggest reasonable factors for settlement patterns without stereotypes','Discuss water, roads and available land','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.2.a']::text[]),
(36,'2.2','Population map challenge','Interpret a verified county settlement map and draw a pattern with a key','Use a teacher-approved county map and respect differences in settlement','Check the learner''s completed task against the stated objective; provide specific feedback.',array['2.2.b','2.2.c']::text[]),
(37,'3.1','Culture in everyday life','Recognise examples of inherited foods, dress, housing and celebrations','Sort diverse illustrated cultural examples','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.1.a']::text[]),
(38,'3.1','Games, objects and stories','Describe the use or meaning of an example from a trusted account','Create a respectful picture caption','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.1.a']::text[]),
(39,'3.1','Recording community traditions','Illustrate a tradition with its context and source','Ask a willing adult or use an approved resource','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.1.b']::text[]),
(40,'3.1','Celebrating local heritage','Explain how a local tradition helps preserve identity and belonging while respecting other traditions','Present a short illustration or story using an approved reference','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.1.c']::text[]),
(41,'3.2','Our school''s story','Tell the story of the school''s founding and one later change using a checked account','Create a simple timeline from a school-approved source or a fictional example for independent learners','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.2.a']::text[]),
(42,'3.2','Our school''s values','Connect two school values to specific everyday decisions','Discuss school-approved values and make a poster','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.2.b']::text[]),
(43,'3.2','Our motto and school rules','Say the school motto and explain why two school rules support a safe, orderly learning environment','Use the actual school motto or a clearly labelled fictional one and make a classroom pledge','Check the learner''s completed task against the stated objective; provide specific feedback.',array['3.2.c','3.2.d']::text[]),
(44,'4.1','Resources around us','Recognise local natural or human-made resources and possible uses','Make a resource-to-use chart','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.1.a']::text[]),
(45,'4.1','Work in our county','Group examples of local jobs into production, trade and services','Sort fictional community enterprise cards','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.1.b']::text[]),
(46,'4.1','Why work matters','Explain how economic activity supports families and communities','Follow a simple goods-and-income story','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.1.c']::text[]),
(47,'4.1','Contributing responsibly','Join an appropriate supervised school or local productive activity and explain its benefit','Choose a safe classroom growing, sorting or craft task without commercial labour','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.1.d','4.1.e']::text[]),
(48,'4.2','Raw materials and products','Match familiar finished goods to their raw materials','Investigate safe household packaging','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.a']::text[]),
(49,'4.2','Local industries','Recognise industries using locally checked examples','Make a picture classification board','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.a']::text[]),
(50,'4.2','From input to output','Describe three stages in a simple production process','Sequence cards for a fictional bakery','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.b']::text[]),
(51,'4.2','Industries and community life','Explain benefits such as jobs and useful products','Discuss a fictional small workshop','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.b']::text[]),
(52,'4.2','Where industries are found','Locate two industries on a checked county map and describe a safe way to learn about their work','Annotate a map or consult a teacher-approved directory','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.c']::text[]),
(53,'4.2','Industry showcase','Explain one county industry and its value using a process diagram','Present an illustrated fact sheet','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.2.d']::text[]),
(54,'4.3','What could we make?','Generate three practical school project ideas','Brainstorm safe low-cost examples','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.a']::text[]),
(55,'4.3','Choosing a project','Compare ideas using usefulness, cost and safety','Vote on a hypothetical classroom project','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.a']::text[]),
(56,'4.3','Making a project plan','List materials, steps and responsibilities','Prepare a simple group planning sheet','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.b']::text[]),
(57,'4.3','Estimating costs','Add small fictional costs and decide what can be reused','Use sample price cards rather than collecting money','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.b']::text[]),
(58,'4.3','Making a prototype','Produce a safe sample with adult supervision','Make a paper bookmark or similar item','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.b']::text[]),
(59,'4.3','Explaining our product','Present the sample and explain its intended users','Hold a mock classroom exhibition','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.b']::text[]),
(60,'4.3','Reviewing the project fairly','Explain how the group shared duties, used materials honestly and can improve its project','Use a team reflection sheet with a record of shared decisions','Check the learner''s completed task against the stated objective; provide specific feedback.',array['4.3.c']::text[]),
(61,'5.1','Being a responsible class member','Distinguish helpful and unhelpful school behaviour','Discuss fictional classroom situations','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.1.a']::text[]),
(62,'5.1','Fairness and honesty','Choose a fair and honest response to a problem','Role-play returning a misplaced pencil','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.1.a']::text[]),
(63,'5.1','Responsibility in action','Demonstrate a helpful classroom responsibility','Complete a safe shared task','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.1.b']::text[]),
(64,'5.1','Our citizenship pledge','Explain why respectful conduct benefits others','Write a personal commitment without public ranking','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.1.c']::text[]),
(65,'5.2','What peaceful school life looks like','Recognise peaceful behaviour in everyday situations','Compare two illustrated playground scenes','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.2.a']::text[]),
(66,'5.2','Handling disagreement','Identify calm words and ways to listen to others','Practise a fictional disagreement with a partner','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.2.b']::text[]),
(67,'5.2','Getting help when needed','Choose a safe response to bullying or conflict','Identify a trusted adult using fictional scenarios','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.2.b']::text[]),
(68,'5.2','Building a peaceful class','Carry out a peaceful class activity and suggest how to continue it','Create a shared peace corner or classroom agreement','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.2.c']::text[]),
(69,'5.3','Every child deserves protection','Identify different kinds of unsafe treatment using non-graphic fictional situations','Match age-appropriate safety scenarios to trusted adult help; never ask for personal disclosures','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.3.a']::text[]),
(70,'5.3','Why children can face harm','Explain in simple terms how unsafe adult choices, exploitation and harmful social practices can endanger children; children are never to blame','Discuss fictional scenarios and practise identifying responsible adults','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.3.b']::text[]),
(71,'5.3','How harm affects children','Explain how unsafe treatment may affect a child''s health, feelings and education','Discuss non-graphic fictional examples without asking for disclosures','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.3.c']::text[]),
(72,'5.3','Getting protection and support','Describe safe help-seeking and take part in a classroom activity promoting child safety and respectful responsibilities','Create a safeguarding poster and practise help-seeking words; include authorised school transport','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.3.d']::text[]),
(73,'5.4','Having a voice','Recognise ways pupils can contribute to school decisions','Discuss fictional class meeting choices','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.4.a']::text[]),
(74,'5.4','Fair decisions','Explain why listening, equal participation and clear rules matter','Compare inclusive and unfair decisions','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.4.b']::text[]),
(75,'5.4','A practice election','Take part in a fictional secret ballot and respect its result','Choose a class project through a supervised mock vote','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.4.c','5.4.d']::text[]),
(76,'5.5','Learner leadership','Recognise pupil leadership roles in a school','Match fictional roles to responsibilities','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.5.a']::text[]),
(77,'5.5','Serving other learners','Describe how learner leaders can represent classmates','Discuss a fictional class improvement request','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.5.b']::text[]),
(78,'5.5','Organising a learner council','Represent a suitable school leadership structure','Create a simple organisation diagram using verified local arrangements','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.5.a']::text[]),
(79,'5.5','Supporting pupil leadership','Take part in a supervised learner-council role play and explain how to support its work respectfully','Hold a fictional council meeting with fair turn-taking','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.5.c','5.5.d']::text[]),
(80,'5.6','Leaders in the community','Recognise locally relevant religious, clan and village leadership roles','Use checked community-role examples without assuming every community has the same structure','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.6.a']::text[]),
(81,'5.6','What leaders do','Explain how local leaders help organise community services','Match community needs to appropriate roles','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.6.b']::text[]),
(82,'5.6','Qualities of helpful leaders','Distinguish responsible and unfair leadership choices','Discuss fictional neighbourhood scenarios','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.6.c']::text[]),
(83,'5.6','Solving a shared problem','Show how a leader can consult and support others','Role-play a safe community clean-up planning meeting','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.6.c']::text[]),
(84,'5.6','Community leadership chart','Explain an appropriate local leadership role and why accountability matters','Present a checked diagram or short report','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.6.d']::text[]),
(85,'5.7','Why counties have governments','Explain the purpose of county-level government in everyday life','Identify familiar county services using checked examples','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.a']::text[]),
(86,'5.7','Parts of county government','Distinguish the county executive and county assembly','Make a two-part organisation diagram','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.a']::text[]),
(87,'5.7','Governor and executive','Describe the governor''s role using an age-appropriate source','Match fictional service decisions to executive functions','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.b']::text[]),
(88,'5.7','County assembly and MCAs','Describe the role of county assembly members in representation and oversight','Discuss a fictional ward concern','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.c']::text[]),
(89,'5.7','County services and participation','Explain how residents can respectfully raise a local concern','Practise a fictional request for a safe public facility','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.d']::text[]),
(90,'5.7','County government review','Draw the county government structure, explain key responsibilities and describe one benefit to residents','Complete an individual diagram and service scenario','Check the learner''s completed task against the stated objective; provide specific feedback.',array['5.7.d']::text[])
 ) as plans(sequence,unit_code,title,objective,activity,assessment,outcome_codes)
 where sequence=p_lesson_sequence and v_unit.source_ref like '%&unit='||unit_code;
 if not found then raise exception 'SCHEME_SOCIAL_LESSON_SCOPE_MISMATCH'; end if;
 select count(*),string_agg(o.outcome_text,E'\n' order by array_position(p_outcome_ids,o.id)),array_agg(o.outcome_code order by o.outcome_code) into v_count,v_objectives,v_selected_codes
 from public.curriculum_learning_outcomes o where o.id=any(p_outcome_ids) and o.sub_strand_id=v_unit.id and o.status='active' and o.source_type='publisher' and o.created_by is null and o.source_ref like 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-4-Social-Studies-20.6.2024-Revised-1.pdf#page=%&outcome=%&provenance=user-transcript-2026-11-24';
 if v_count is distinct from cardinality(p_outcome_ids) or v_selected_codes is distinct from array(select unnest(v_plan.outcome_codes) order by 1) then raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH'; end if;
 v_scheme:=public.commit_custom_scheme_item(p_class_id,p_subject_id,p_academic_term_id,p_week,v_plan.title,v_unit.name,null,null);
 update public.scheme_of_work set sub_strand_id=v_unit.id,sub_strand=v_unit.sub_strand,objectives=v_plan.objective,learning_experiences=v_plan.activity,assessment_methods=v_plan.assessment,curriculum_outcome_id=case when v_count>0 then p_outcome_ids[1] else null end,reference=v_unit.source_ref||' (user-supplied KICD text; original VibeSchool scheme objective; independent verification pending)' where id=v_scheme.id and teacher_id=auth.uid() returning * into v_saved;
 if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;
 insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id) select v_saved.id,unnest(p_outcome_ids);
 return v_saved;
end;
$fn$;
revoke all on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[],integer) from public;
grant execute on function public.commit_grade4_social_studies_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[],integer) to authenticated;
commit;
