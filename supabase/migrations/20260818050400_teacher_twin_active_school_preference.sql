-- Teacher Twin active-school preference.
--
-- The preceding multi-school migration makes school an explicit state/memory identity
-- and adds school-scoped RPC overloads. This migration keeps existing zero-argument
-- clients compatible without arbitrary LIMIT 1 selection: a multi-school Teacher may
-- use teacher_profiles.school_id only when that value is still backed by a current
-- Teacher school_members relationship. Changing it is itself an authorized RPC.

create or replace function public.teacher_set_active_twin_school(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer := 0;
begin
  perform public.hq_require_policy_enabled('twin','twin.enabled');
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'teacher_school_scope_required'; end if;

  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role = 'teacher'
  ) then
    raise exception 'teacher_school_scope_not_authorized';
  end if;

  update public.teacher_profiles tp
     set school_id = p_school_id
   where tp.profile_id = v_uid;
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'teacher_profile_not_found';
  end if;

  return jsonb_build_object(
    'teacher_id', v_uid,
    'school_id', p_school_id,
    'active_scope', true
  );
end;
$$;

create or replace function public.teacher_refresh_twin_memory()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_preferred uuid;
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select tp.school_id into v_preferred
  from public.teacher_profiles tp
  where tp.profile_id = v_uid;

  if v_preferred is not null and exists (
    select 1 from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = v_preferred
      and sm.role = 'teacher'
  ) then
    return public.teacher_refresh_twin_memory(v_preferred);
  end if;

  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';

  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_refresh_twin_memory(v_schools[1]);
end;
$$;

create or replace function public.teacher_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_preferred uuid;
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select tp.school_id into v_preferred
  from public.teacher_profiles tp
  where tp.profile_id = v_uid;

  if v_preferred is not null and exists (
    select 1 from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = v_preferred
      and sm.role = 'teacher'
  ) then
    return public.teacher_get_twin_brain(v_preferred);
  end if;

  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';

  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_get_twin_brain(v_schools[1]);
end;
$$;

create or replace function public.teacher_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_preferred uuid;
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select tp.school_id into v_preferred
  from public.teacher_profiles tp
  where tp.profile_id = v_uid;

  if v_preferred is not null and exists (
    select 1 from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = v_preferred
      and sm.role = 'teacher'
  ) then
    return public.teacher_get_twin_tutor_context(v_preferred);
  end if;

  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';

  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_get_twin_tutor_context(v_schools[1]);
end;
$$;

revoke all on function public.teacher_set_active_twin_school(uuid) from public, anon;
revoke all on function public.teacher_refresh_twin_memory() from public, anon;
revoke all on function public.teacher_get_twin_brain() from public, anon;
revoke all on function public.teacher_get_twin_tutor_context() from public, anon;

grant execute on function public.teacher_set_active_twin_school(uuid) to authenticated, service_role;
grant execute on function public.teacher_refresh_twin_memory() to authenticated, service_role;
grant execute on function public.teacher_get_twin_brain() to authenticated, service_role;
grant execute on function public.teacher_get_twin_tutor_context() to authenticated, service_role;
