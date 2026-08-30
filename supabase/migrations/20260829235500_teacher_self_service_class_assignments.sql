-- Teacher self-service class assignment across the complete Kenyan school structure.
-- Reuses canonical school classes and rejects cross-school or non-teacher callers.

create unique index if not exists uq_classes_school_normalized_name_stream
  on public.classes (
    school_id,
    lower(btrim(name)),
    lower(btrim(coalesce(stream, '')))
  )
  where school_id is not null;

create unique index if not exists uq_global_subject_normalized_name
  on public.subjects (lower(btrim(name)))
  where school_id is null;

insert into public.subjects (name)
select required.name
from unnest(array[
  'Mathematics', 'English', 'Kiswahili', 'Science and Technology',
  'Social Studies', 'Religious Education', 'Creative Arts and Sports',
  'Agriculture and Nutrition', 'Home Science', 'Indigenous Languages',
  'French', 'German', 'Arabic', 'Kenyan Sign Language',
  'Biology', 'Chemistry', 'Physics', 'History and Government',
  'Geography', 'Business Studies', 'Computer Studies',
  'Christian Religious Education', 'Islamic Religious Education',
  'Hindu Religious Education', 'Music', 'Art and Design'
]) as required(name)
where not exists (
  select 1 from public.subjects existing
  where existing.school_id is null
    and lower(btrim(existing.name)) = lower(required.name)
);

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
  v_subject text := regexp_replace(btrim(coalesce(p_subject, '')), '\s+', ' ', 'g');
  v_class_id uuid;
  v_subject_id uuid;
  v_global_subject_id uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.role::text, p.account_status::text, coalesce(p.is_anonymized, false)
    into v_role, v_status, v_anonymized
  from public.profiles p
  where p.id = v_uid;

  if not found
     or v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'teacher_authority_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role::text = 'teacher'
  ) then
    raise exception 'teacher_school_membership_required' using errcode = '42501';
  end if;

  if v_grade <> all (array[
    'PP1', 'PP2',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    'Form 1', 'Form 2', 'Form 3', 'Form 4'
  ]) then
    raise exception 'invalid_class_level' using errcode = '22023';
  end if;

  if char_length(v_stream) > 40 then
    raise exception 'invalid_stream' using errcode = '22023';
  end if;
  if char_length(v_subject) < 2 or char_length(v_subject) > 120 then
    raise exception 'invalid_subject' using errcode = '22023';
  end if;

  -- Serialize the same school/class/stream identity before the insert/select pair.
  perform pg_advisory_xact_lock(hashtextextended(
    p_school_id::text || '|' || lower(v_grade) || '|' || lower(v_stream),
    0
  ));

  select s.id into v_global_subject_id
  from public.subjects s
  where s.school_id is null
    and lower(btrim(s.name)) = lower(v_subject)
  limit 1;

  if v_global_subject_id is null then
    raise exception 'invalid_subject' using errcode = '22023';
  end if;

  insert into public.subjects (school_id, name, global_subject_id)
  values (p_school_id, v_subject, v_global_subject_id)
  on conflict (school_id, name) do update
    set global_subject_id = coalesce(public.subjects.global_subject_id, excluded.global_subject_id)
  returning id into v_subject_id;

  select c.id into v_class_id
  from public.classes c
  where c.school_id = p_school_id
    and lower(btrim(c.name)) = lower(v_grade)
    and lower(btrim(coalesce(c.stream, ''))) = lower(v_stream)
  limit 1;

  if v_class_id is null then
    insert into public.classes (school_id, teacher_id, name, stream, subject)
    values (p_school_id, v_uid, v_grade, nullif(v_stream, ''), v_subject)
    on conflict do nothing
    returning id into v_class_id;

    if v_class_id is null then
      select c.id into v_class_id
      from public.classes c
      where c.school_id = p_school_id
        and lower(btrim(c.name)) = lower(v_grade)
        and lower(btrim(coalesce(c.stream, ''))) = lower(v_stream)
      limit 1;
    end if;
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

revoke all on function public.create_teacher_class_assignment(uuid,text,text,text,boolean)
  from public, anon, service_role;
grant execute on function public.create_teacher_class_assignment(uuid,text,text,text,boolean)
  to authenticated;

-- Preserve the onboarding contract for older clients while routing all writes
-- through the same validated, duplicate-safe implementation.
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

revoke all on function public.onboard_teacher_class(uuid,uuid,text,text,text)
  from public, anon, service_role;
grant execute on function public.onboard_teacher_class(uuid,uuid,text,text,text)
  to authenticated;
