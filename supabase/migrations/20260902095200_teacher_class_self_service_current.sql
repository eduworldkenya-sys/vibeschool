begin;

create unique index if not exists uq_classes_school_normalized_name_stream
  on public.classes (school_id, lower(btrim(name)), lower(btrim(coalesce(stream, ''))))
  where school_id is not null;

create unique index if not exists uq_subjects_global_normalized_name
  on public.subjects (lower(btrim(name)))
  where school_id is null;

create unique index if not exists uq_subjects_school_normalized_name
  on public.subjects (school_id, lower(btrim(name)))
  where school_id is not null;

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
set search_path = public, auth, pg_temp
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
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid
      and p.role::text = 'teacher'
      and p.account_status::text = 'active'
      and not coalesce(p.is_anonymized, false)
  ) then
    raise exception 'teacher_authority_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role::text = 'teacher'
  ) then
    raise exception 'teacher_school_membership_required' using errcode = '42501';
  end if;

  if v_grade <> all (array[
    'PP1','PP2',
    'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
    'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
    'Form 1','Form 2','Form 3','Form 4'
  ]) then
    raise exception 'invalid_class_level' using errcode = '22023';
  end if;

  if char_length(v_stream) > 40 then
    raise exception 'invalid_stream' using errcode = '22023';
  end if;
  if char_length(v_subject_input) < 2 or char_length(v_subject_input) > 120 then
    raise exception 'invalid_subject' using errcode = '22023';
  end if;

  select s.id, s.name
    into v_global_subject_id, v_subject_name
  from public.subjects s
  where s.school_id is null
    and lower(btrim(s.name)) = lower(v_subject_input)
  limit 1;

  if v_global_subject_id is null then
    raise exception 'invalid_subject' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_school_id::text || '|subject|' || lower(v_subject_name), 0
  ));

  select s.id into v_subject_id
  from public.subjects s
  where s.school_id = p_school_id
    and lower(btrim(s.name)) = lower(v_subject_name)
  limit 1;

  if v_subject_id is null then
    insert into public.subjects (school_id, name, global_subject_id)
    values (p_school_id, v_subject_name, v_global_subject_id)
    returning id into v_subject_id;
  else
    update public.subjects
      set global_subject_id = coalesce(global_subject_id, v_global_subject_id)
      where id = v_subject_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_school_id::text || '|class|' || lower(v_grade) || '|' || lower(v_stream), 0
  ));

  select c.id into v_class_id
  from public.classes c
  where c.school_id = p_school_id
    and lower(btrim(c.name)) = lower(v_grade)
    and lower(btrim(coalesce(c.stream, ''))) = lower(v_stream)
  limit 1;

  if v_class_id is null then
    insert into public.classes (school_id, teacher_id, name, stream, subject)
    values (p_school_id, v_uid, v_grade, nullif(v_stream, ''), v_subject_name)
    returning id into v_class_id;
  end if;

  insert into public.teacher_classes (
    school_id, teacher_id, class_id, subject_id, is_class_teacher
  ) values (
    p_school_id, v_uid, v_class_id, v_subject_id, coalesce(p_is_class_teacher, false)
  )
  on conflict (teacher_id, class_id, subject_id) do update
    set is_class_teacher = public.teacher_classes.is_class_teacher or excluded.is_class_teacher;

  return v_class_id;
end;
$$;

create or replace function public.onboard_teacher_class(
  p_school_id uuid,
  p_teacher_id uuid,
  p_grade text,
  p_stream text,
  p_subject text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then
    raise exception 'unauthorized_identity' using errcode = '42501';
  end if;

  return public.create_teacher_class_assignment(
    p_school_id,
    p_grade,
    p_stream,
    p_subject,
    true
  );
end;
$$;

revoke all on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) from public, anon, service_role;
grant execute on function public.create_teacher_class_assignment(uuid,text,text,text,boolean) to authenticated;
revoke all on function public.onboard_teacher_class(uuid,uuid,text,text,text) from public, anon, service_role;
grant execute on function public.onboard_teacher_class(uuid,uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
