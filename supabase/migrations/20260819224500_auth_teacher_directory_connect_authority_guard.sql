begin;

create or replace function public.connect_teacher_to_directory_school(
  p_directory_id uuid,
  p_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
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

  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;

  if v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'teacher_authority_required' using errcode = '42501';
  end if;

  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then
    raise exception 'invalid_education_level' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.schools_directory d
    where d.id = p_directory_id
      and lower(coalesce(d.status, 'active')) <> 'closed'
  ) then
    raise exception 'directory_school_not_found' using errcode = '22023';
  end if;

  select c.canonical_school_id
    into v_school
  from public.school_identity_candidates c
  join public.schools s
    on s.id = c.canonical_school_id
   and s.deleted_at is null
   and s.status in ('pending','active')
  where c.directory_school_id = p_directory_id
    and c.status in ('matched','new')
    and c.canonical_school_id is not null
    and c.reviewed_by is not null
    and c.reviewed_at is not null
  order by c.reviewed_at desc, c.updated_at desc
  limit 1;

  if v_school is null then
    raise exception 'school_identity_review_required' using errcode = '42501';
  end if;

  insert into public.school_members(school_id, profile_id, role)
  values(v_school, v_uid, 'teacher')
  on conflict(school_id, profile_id) do nothing;

  update public.profiles
  set school_id = v_school
  where id = v_uid;

  insert into public.teacher_profiles(profile_id, school_id)
  values(v_uid, v_school)
  on conflict(profile_id) do update set school_id = excluded.school_id;

  if p_level is not null then
    insert into public.school_levels(school_id, level)
    values(v_school, p_level)
    on conflict do nothing;
  end if;

  return v_school;
end;
$$;

revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public, anon, service_role;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

comment on function public.connect_teacher_to_directory_school(uuid,text) is
  'Teacher onboarding only: current active teacher may connect to an owner-reviewed canonical school identity. Non-teacher, inactive, anonymized and anonymous callers fail closed.';

notify pgrst, 'reload schema';
commit;
