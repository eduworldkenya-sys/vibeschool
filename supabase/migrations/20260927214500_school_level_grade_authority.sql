begin;

create or replace function public.get_allowed_teaching_levels(p_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_levels text[];
  v_source text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_uid and p.role::text='teacher'
      and p.account_status::text='active'
      and not coalesce(p.is_anonymized,false)
  ) then
    raise exception 'teacher_authority_required' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.school_members sm
    where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher'
  ) then
    raise exception 'teacher_school_membership_required' using errcode='42501';
  end if;

  select array_agg(distinct upper(btrim(sl.level)) order by upper(btrim(sl.level)))
    into v_levels
  from public.school_levels sl
  where sl.school_id=p_school_id;

  if coalesce(array_length(v_levels,1),0)>0 then
    v_source:='school_levels';
  else
    v_source:='unresolved';
  end if;

  return jsonb_build_object(
    'state',case when v_source='unresolved' then 'needs_resolution' else 'ready' end,
    'school_id',p_school_id,
    'source',v_source,
    'phases',coalesce(to_jsonb(v_levels),'[]'::jsonb),
    'levels',case when v_source='unresolved' then '[]'::jsonb else (
      select coalesce(jsonb_agg(x.label order by x.sort_order),'[]'::jsonb)
      from (
        select * from (values
          ('EARLY_YEARS','PP1',1),('EARLY_YEARS','PP2',2),
          ('PRIMARY','Grade 1',10),('PRIMARY','Grade 2',11),('PRIMARY','Grade 3',12),
          ('PRIMARY','Grade 4',13),('PRIMARY','Grade 5',14),('PRIMARY','Grade 6',15),
          ('JUNIOR','Grade 7',20),('JUNIOR','Grade 8',21),('JUNIOR','Grade 9',22),
          ('SENIOR_SECONDARY','Grade 10',30),('SENIOR_SECONDARY','Grade 11',31),('SENIOR_SECONDARY','Grade 12',32),
          ('LEGACY_SECONDARY','Form 1',40),('LEGACY_SECONDARY','Form 2',41),('LEGACY_SECONDARY','Form 3',42),('LEGACY_SECONDARY','Form 4',43)
        ) as t(phase,label,sort_order)
        where t.phase = any(v_levels)
      ) x
    ) end
  );
end;
$$;

revoke all on function public.get_allowed_teaching_levels(uuid) from public,anon,service_role;
grant execute on function public.get_allowed_teaching_levels(uuid) to authenticated;

create or replace function public.get_allowed_teaching_subjects(p_school_id uuid,p_grade text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth,extensions,pg_temp
as $$
declare
  v_authority jsonb;
  v_grade text:=btrim(coalesce(p_grade,''));
begin
  v_authority:=public.get_allowed_teaching_levels(p_school_id);
  if (v_authority->>'state')<>'ready' then
    return jsonb_build_object('state','needs_resolution','subjects','[]'::jsonb);
  end if;
  if not exists(
    select 1 from jsonb_array_elements_text(v_authority->'levels') j(value)
    where j.value=v_grade
  ) then
    raise exception 'invalid_class_level_for_school' using errcode='22023';
  end if;

  return jsonb_build_object(
    'state','ready',
    'subjects',coalesce((
      select jsonb_agg(distinct c.subject order by c.subject)
      from public.curriculum c
      where c.grade=v_grade and c.subject is not null and btrim(c.subject)<>''
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_allowed_teaching_subjects(uuid,text) from public,anon,service_role;
grant execute on function public.get_allowed_teaching_subjects(uuid,text) to authenticated;

create or replace function public.create_teacher_class_assignment(
  p_school_id uuid,
  p_grade text,
  p_stream text,
  p_subject text,
  p_is_class_teacher boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_grade text := btrim(coalesce(p_grade, ''));
  v_stream text := regexp_replace(btrim(coalesce(p_stream, '')), '\s+', ' ', 'g');
  v_subject_input text := regexp_replace(btrim(coalesce(p_subject, '')), '\s+', ' ', 'g');
  v_subject_name text;
  v_class_id uuid;
  v_subject_id uuid;
  v_global_subject_id uuid;
  v_authority jsonb;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
    then raise exception 'teacher_authority_required' using errcode='42501'; end if;
  if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher')
    then raise exception 'teacher_school_membership_required' using errcode='42501'; end if;

  v_authority:=public.get_allowed_teaching_levels(p_school_id);
  if (v_authority->>'state')<>'ready' then
    raise exception 'school_level_authority_unresolved' using errcode='22023';
  end if;
  if not exists(select 1 from jsonb_array_elements_text(v_authority->'levels') j(value) where j.value=v_grade) then
    raise exception 'invalid_class_level_for_school' using errcode='22023';
  end if;

  if char_length(v_stream)>40 then raise exception 'invalid_stream' using errcode='22023'; end if;
  if char_length(v_subject_input)<2 or char_length(v_subject_input)>120 then raise exception 'invalid_subject' using errcode='22023'; end if;
  if not exists(select 1 from public.curriculum c where c.grade=v_grade and lower(btrim(c.subject))=lower(v_subject_input)) then
    raise exception 'invalid_subject_for_level' using errcode='22023';
  end if;

  select s.id,s.name into v_global_subject_id,v_subject_name
  from public.subjects s
  where s.school_id is null and lower(btrim(s.name))=lower(v_subject_input)
  limit 1;
  if v_global_subject_id is null then raise exception 'invalid_subject' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||'|subject|'||lower(v_subject_name),0));
  select s.id into v_subject_id from public.subjects s
  where s.school_id=p_school_id and lower(btrim(s.name))=lower(v_subject_name) limit 1;
  if v_subject_id is null then
    insert into public.subjects(school_id,name,global_subject_id)
    values(p_school_id,v_subject_name,v_global_subject_id) returning id into v_subject_id;
  else
    update public.subjects set global_subject_id=coalesce(global_subject_id,v_global_subject_id) where id=v_subject_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||'|class|'||lower(v_grade)||'|'||lower(v_stream),0));
  select c.id into v_class_id from public.classes c
  where c.school_id=p_school_id and lower(btrim(c.name))=lower(v_grade)
    and lower(btrim(coalesce(c.stream,'')))=lower(v_stream) limit 1;
  if v_class_id is null then
    insert into public.classes(school_id,teacher_id,name,stream,subject)
    values(p_school_id,v_uid,v_grade,nullif(v_stream,''),v_subject_name)
    returning id into v_class_id;
  end if;

  insert into public.teacher_classes(school_id,teacher_id,class_id,subject_id,is_class_teacher)
  values(p_school_id,v_uid,v_class_id,v_subject_id,coalesce(p_is_class_teacher,false))
  on conflict(teacher_id,class_id,subject_id) do update
  set is_class_teacher=public.teacher_classes.is_class_teacher or excluded.is_class_teacher;

  return v_class_id;
end;
$$;

revoke all on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) from public,anon,service_role;
grant execute on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
