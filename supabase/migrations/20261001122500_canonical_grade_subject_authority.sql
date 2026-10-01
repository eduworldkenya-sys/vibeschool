begin;
create table if not exists public.grade_subject_authority(
 grade text not null, phase text not null check(phase in('EARLY_YEARS','PRIMARY','JUNIOR','SENIOR_SECONDARY','LEGACY_SECONDARY')),
 subject_name text not null, pathway text, subject_kind text not null default 'learning_area' check(subject_kind in('core','elective','learning_area')),
 source_authority text not null default 'KICD', source_ref text, effective_from date not null default date '2026-01-01', effective_to date,
 created_at timestamptz not null default now(), primary key(grade,subject_name));
alter table public.grade_subject_authority enable row level security;
revoke all on public.grade_subject_authority from public,anon,authenticated;
grant select on public.grade_subject_authority to authenticated;
drop policy if exists grade_subject_authority_authenticated_read on public.grade_subject_authority;
create policy grade_subject_authority_authenticated_read on public.grade_subject_authority for select to authenticated using(true);

insert into public.grade_subject_authority(grade,phase,subject_name,source_ref)
select x.grade,case when x.grade in('PP1','PP2') then 'EARLY_YEARS' when x.grade in('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6') then 'PRIMARY'
 when x.grade in('Grade 7','Grade 8','Grade 9') then 'JUNIOR' else 'LEGACY_SECONDARY' end,x.subject_name,'VibeSchool canonical curriculum import'
from (
 select distinct btrim(c.grade) grade,btrim(c.subject) subject_name from public.curriculum c
 where c.grade in('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Form 1','Form 2','Form 3','Form 4') and nullif(btrim(c.subject),'') is not null
 union
 select distinct btrim(cs.grade),btrim(s.name) from public.cbc_strands cs join public.subjects s on s.id=cs.subject_id and s.school_id is null
 where cs.grade in('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Form 1','Form 2','Form 3','Form 4') and nullif(btrim(s.name),'') is not null
) x on conflict(grade,subject_name) do update set phase=excluded.phase;

with senior(subject_name,pathway,subject_kind) as (values
 ('English',null,'core'),('Kiswahili',null,'core'),('Kenyan Sign Language',null,'core'),('Core Mathematics','STEM','core'),('Essential Mathematics',null,'core'),('Community Service Learning',null,'core'),
 ('Sports and Recreation','Arts & Sports Science','elective'),('Music and Dance','Arts & Sports Science','elective'),('Theatre and Film','Arts & Sports Science','elective'),('Fine Arts','Arts & Sports Science','elective'),
 ('Literature in English','Social Sciences','elective'),('Indigenous Languages','Social Sciences','elective'),('Fasihi ya Kiswahili','Social Sciences','elective'),('Arabic','Social Sciences','elective'),('French','Social Sciences','elective'),('German','Social Sciences','elective'),('Mandarin Chinese','Social Sciences','elective'),
 ('Christian Religious Education','Social Sciences','elective'),('Islamic Religious Education','Social Sciences','elective'),('Hindu Religious Education','Social Sciences','elective'),('Business Studies','Social Sciences','elective'),('History and Citizenship','Social Sciences','elective'),('Geography','Social Sciences','elective'),
 ('Biology','STEM','elective'),('Chemistry','STEM','elective'),('Physics','STEM','elective'),('General Science','STEM','elective'),('Agriculture','STEM','elective'),('Computer Studies','STEM','elective'),('Home Science','STEM','elective'),('Aviation','STEM','elective'),('Building Construction','STEM','elective'),('Electricity','STEM','elective'),('Metalwork','STEM','elective'),('Power Mechanics','STEM','elective'),('Wood Technology','STEM','elective'),('Media Technology','STEM','elective'),('Marine and Fisheries Technology','STEM','elective')
), grades(grade) as(values('Grade 10'),('Grade 11'),('Grade 12'))
insert into public.grade_subject_authority(grade,phase,subject_name,pathway,subject_kind,source_ref)
select g.grade,'SENIOR_SECONDARY',s.subject_name,s.pathway,s.subject_kind,'KICD Senior School curriculum / approved materials structure' from grades g cross join senior s
on conflict(grade,subject_name) do update set phase=excluded.phase,pathway=excluded.pathway,subject_kind=excluded.subject_kind,source_authority='KICD',source_ref=excluded.source_ref,effective_to=null;

insert into public.subjects(school_id,name)
select null,g.subject_name from(select distinct subject_name from public.grade_subject_authority) g
where not exists(select 1 from public.subjects s where s.school_id is null and lower(btrim(s.name))=lower(btrim(g.subject_name)));
create index if not exists grade_subject_authority_phase_grade_idx on public.grade_subject_authority(phase,grade);
create index if not exists grade_subject_authority_pathway_idx on public.grade_subject_authority(pathway) where pathway is not null;

create or replace function public.get_allowed_teaching_subjects(p_school_id uuid,p_grade text) returns jsonb language plpgsql stable security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_authority jsonb; v_grade text:=btrim(coalesce(p_grade,''));
begin
 v_authority:=public.get_allowed_teaching_levels(p_school_id);
 if(v_authority->>'state')<>'ready' then return jsonb_build_object('state','needs_resolution','subjects','[]'::jsonb,'source','grade_subject_authority'); end if;
 if not exists(select 1 from jsonb_array_elements_text(v_authority->'levels') j(value) where j.value=v_grade) then raise exception 'invalid_class_level_for_school' using errcode='22023'; end if;
 return jsonb_build_object('state','ready','source','grade_subject_authority','subjects',coalesce((select jsonb_agg(g.subject_name order by g.subject_name) from public.grade_subject_authority g where g.grade=v_grade and g.effective_from<=current_date and(g.effective_to is null or g.effective_to>=current_date)),'[]'::jsonb));
end;$$;
revoke all on function public.get_allowed_teaching_subjects(uuid,text) from public,anon,service_role; grant execute on function public.get_allowed_teaching_subjects(uuid,text) to authenticated;

create or replace function public.is_valid_teaching_subject_for_grade(p_grade text,p_subject_name text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.grade_subject_authority g where g.grade=btrim(p_grade) and lower(btrim(g.subject_name))=lower(btrim(p_subject_name)) and g.effective_from<=current_date and(g.effective_to is null or g.effective_to>=current_date));$$;
revoke all on function public.is_valid_teaching_subject_for_grade(text,text) from public,anon; grant execute on function public.is_valid_teaching_subject_for_grade(text,text) to authenticated,service_role;

create or replace function public.create_teacher_class_assignment(p_school_id uuid,p_grade text,p_stream text,p_subject text,p_is_class_teacher boolean default false) returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid();v_grade text:=btrim(coalesce(p_grade,''));v_stream text:=regexp_replace(btrim(coalesce(p_stream,'')),'\s+',' ','g');v_subject_input text:=regexp_replace(btrim(coalesce(p_subject,'')),'\s+',' ','g');v_subject_name text;v_class_id uuid;v_subject_id uuid;v_global_subject_id uuid;v_authority jsonb;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'teacher_authority_required' using errcode='42501';end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher') then raise exception 'teacher_school_membership_required' using errcode='42501';end if;
 v_authority:=public.get_allowed_teaching_levels(p_school_id);
 if(v_authority->>'state')<>'ready' then raise exception 'school_level_authority_unresolved' using errcode='22023';end if;
 if not exists(select 1 from jsonb_array_elements_text(v_authority->'levels') j(value) where j.value=v_grade) then raise exception 'invalid_class_level_for_school' using errcode='22023';end if;
 if char_length(v_stream)>40 then raise exception 'invalid_stream' using errcode='22023';end if;
 select g.subject_name into v_subject_name from public.grade_subject_authority g where g.grade=v_grade and lower(btrim(g.subject_name))=lower(v_subject_input) and g.effective_from<=current_date and(g.effective_to is null or g.effective_to>=current_date) limit 1;
 if v_subject_name is null then raise exception 'invalid_subject_for_level' using errcode='22023';end if;
 select s.id into v_global_subject_id from public.subjects s where s.school_id is null and lower(btrim(s.name))=lower(v_subject_name) limit 1;
 if v_global_subject_id is null then raise exception 'canonical_subject_missing' using errcode='23503';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||'|subject|'||lower(v_subject_name),0));
 select s.id into v_subject_id from public.subjects s where s.school_id=p_school_id and lower(btrim(s.name))=lower(v_subject_name) limit 1;
 if v_subject_id is null then insert into public.subjects(school_id,name,global_subject_id) values(p_school_id,v_subject_name,v_global_subject_id) returning id into v_subject_id;else update public.subjects set global_subject_id=coalesce(global_subject_id,v_global_subject_id) where id=v_subject_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||'|class|'||lower(v_grade)||'|'||lower(v_stream),0));
 select c.id into v_class_id from public.classes c where c.school_id=p_school_id and lower(btrim(c.name))=lower(v_grade) and lower(btrim(coalesce(c.stream,'')))=lower(v_stream) limit 1;
 if v_class_id is null then insert into public.classes(school_id,teacher_id,name,stream,subject) values(p_school_id,v_uid,v_grade,nullif(v_stream,''),v_subject_name) returning id into v_class_id;end if;
 insert into public.teacher_classes(school_id,teacher_id,class_id,subject_id,is_class_teacher) values(p_school_id,v_uid,v_class_id,v_subject_id,coalesce(p_is_class_teacher,false))
 on conflict(teacher_id,class_id,subject_id) do update set is_class_teacher=public.teacher_classes.is_class_teacher or excluded.is_class_teacher;
 return v_class_id;
end;$$;
revoke all on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) from public,anon,service_role;grant execute on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) to authenticated;
notify pgrst,'reload schema';commit;