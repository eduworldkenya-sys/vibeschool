begin;

-- Production drift repair: teacher_set_active_school had regressed to updating
-- only teacher_active_school_preferences. profiles.school_id and
-- teacher_profiles.school_id are legacy compatibility pointers (never
-- authorization), but older Teacher OS consumers still read them. Keep those
-- pointers aligned only after the canonical teacher membership check.
create or replace function public.teacher_set_active_school(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_school_id is null then
    raise exception 'teacher_school_scope_required';
  end if;

  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role::text = 'teacher'
  ) then
    raise exception 'teacher_school_scope_not_authorized';
  end if;

  insert into public.teacher_active_school_preferences(
    teacher_id,
    school_id,
    updated_at
  )
  values (v_uid, p_school_id, clock_timestamp())
  on conflict (teacher_id)
  do update set
    school_id = excluded.school_id,
    updated_at = excluded.updated_at;

  insert into public.teacher_profiles(profile_id, school_id)
  values (v_uid, p_school_id)
  on conflict (profile_id)
  do update set
    school_id = excluded.school_id,
    updated_at = clock_timestamp();

  update public.profiles
  set school_id = p_school_id,
      updated_at = clock_timestamp()
  where id = v_uid
    and role = 'teacher';

  return jsonb_build_object(
    'teacher_id', v_uid,
    'school_id', p_school_id
  );
end;
$$;

revoke all on function public.teacher_set_active_school(uuid) from public, anon;
grant execute on function public.teacher_set_active_school(uuid) to authenticated, service_role;

commit;
