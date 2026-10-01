begin;
-- Complete regular-curriculum catalog from current KICD designs. These rows are
-- structure authority and remain independent from authored VibeSchool content.
with pp(subject_name) as(values('Language Activities'),('Mathematical Activities'),('Creative Activities'),('Environmental Activities'),('Christian Religious Education'),('Islamic Religious Education'),('Hindu Religious Education')),
grades(grade) as(values('PP1'),('PP2'))
insert into public.grade_subject_authority(grade,phase,subject_name,source_ref)
select g.grade,'EARLY_YEARS',p.subject_name,'KICD revised Pre-Primary designs' from grades g cross join pp p
on conflict(grade,subject_name) do update set phase=excluded.phase,source_authority='KICD',source_ref=excluded.source_ref,effective_to=null;

with upper_primary(subject_name) as(values('Agriculture'),('Arabic'),('Creative Arts'),('Christian Religious Education'),('English'),('French'),('German'),('Hindu Religious Education'),('Indigenous Language'),('Islamic Religious Education'),('Kiswahili'),('Mandarin'),('Mathematics'),('Science & Technology'),('Social Studies')),
grades(grade) as(values('Grade 4'),('Grade 5'),('Grade 6'))
insert into public.grade_subject_authority(grade,phase,subject_name,source_ref)
select g.grade,'PRIMARY',s.subject_name,'KICD regular curriculum designs' from grades g cross join upper_primary s
on conflict(grade,subject_name) do update set phase=excluded.phase,source_authority='KICD',source_ref=excluded.source_ref,effective_to=null;

with junior(subject_name) as(values('Agriculture'),('Arabic'),('Creative Arts'),('Christian Religious Education'),('English'),('French'),('German'),('Hindu Religious Education'),('Indigenous Language'),('Integrated Science'),('Islamic Religious Education'),('Kiswahili'),('Mandarin'),('Mathematics'),('Pre-Technical Studies'),('Social Studies')),
grades(grade) as(values('Grade 7'),('Grade 8'),('Grade 9'))
insert into public.grade_subject_authority(grade,phase,subject_name,source_ref)
select g.grade,'JUNIOR',s.subject_name,'KICD regular curriculum designs' from grades g cross join junior s
on conflict(grade,subject_name) do update set phase=excluded.phase,source_authority='KICD',source_ref=excluded.source_ref,effective_to=null;

insert into public.subjects(school_id,name)
select null,g.subject_name from(select distinct subject_name from public.grade_subject_authority) g
where not exists(select 1 from public.subjects s where s.school_id is null and lower(btrim(s.name))=lower(btrim(g.subject_name)));
notify pgrst,'reload schema';commit;