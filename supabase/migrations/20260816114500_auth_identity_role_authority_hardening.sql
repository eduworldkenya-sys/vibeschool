-- Auth & onboarding hardening: one canonical identity/role authority.
-- Requested OAuth/signup role is onboarding intent only; it is never authorization metadata.

alter table public.profiles alter column role drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.profiles (id, full_name, role, account_status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      null,
      'active'
    )
    on conflict (id) do nothing;
  exception when others then
    begin
      insert into public.signup_provisioning_failures(user_id, error_message)
      values (new.id, sqlerrm);
    exception when others then
      null;
    end;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;

create or replace function public.claim_my_initial_role(p_role text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current_role text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('teacher', 'parent', 'global_user') then
    raise exception 'role_not_self_service' using errcode = '22023';
  end if;

  select p.role, p.account_status::text
    into v_current_role, v_status
  from public.profiles p
  where p.id = v_uid
  for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if v_status is distinct from 'active' then
    raise exception 'account_not_active' using errcode = '42501';
  end if;

  -- Existing role is immutable through this entrypoint. This makes callback
  -- replay and cross-role signup attempts idempotent and fail-safe.
  if v_current_role is not null then
    return v_current_role;
  end if;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = v_uid
    and role is null;

  select role into v_current_role
  from public.profiles
  where id = v_uid;

  return v_current_role;
end;
$$;

revoke all on function public.claim_my_initial_role(text) from public, anon;
grant execute on function public.claim_my_initial_role(text) to authenticated;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

-- A school_id is not proof of teacher authority. Only a canonical teacher role
-- can create the derived teacher membership row.
create or replace function public.ensure_school_member()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.school_id is not null and new.role = 'teacher' then
    insert into public.school_members (profile_id, school_id, role)
    values (new.id, new.school_id, 'teacher')
    on conflict (school_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.get_my_onboarding_state()
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  p public.profiles%rowtype;
  school_count integer := 0;
  class_count integer := 0;
  child_count integer := 0;
begin
  select * into p from public.profiles where id = auth.uid();

  if p.id is null then
    return jsonb_build_object('state','profile_missing','next_action','contact_support','destination','/auth/error?reason=profile_missing');
  end if;

  if p.account_status::text is distinct from 'active' then
    return jsonb_build_object('state','account_inactive','next_action','contact_support','destination','/auth/error?reason=account_inactive');
  end if;

  if p.role is null then
    return jsonb_build_object('state','role_required','next_action','complete_registration','destination','/auth/error?reason=role_required');
  end if;

  if p.role = 'student' then
    return jsonb_build_object('state','ready','next_action','none','destination','/student');
  end if;
  if p.role = 'admin' then
    return jsonb_build_object('state','ready','next_action','none','destination','/admin');
  end if;
  if p.role = 'global_user' then
    return jsonb_build_object('state','ready','next_action','none','destination','/global');
  end if;

  if p.role = 'teacher' then
    select count(*) into school_count
      from public.school_members sm
      where sm.profile_id = p.id and sm.role = 'teacher';
    select count(*) into class_count
      from public.teacher_classes tc
      where tc.teacher_id = p.id and coalesce(tc.is_active, true);

    if school_count = 0 then
      return jsonb_build_object('state','needs_school','next_action','find_school','destination','/teacher/onboarding/school');
    end if;
    if class_count = 0 then
      return jsonb_build_object('state','needs_class','next_action','choose_class','destination','/teacher/onboarding/class');
    end if;
    return jsonb_build_object('state','ready','next_action','none','destination','/teacher/pulse');
  end if;

  if p.role = 'parent' then
    select count(*) into child_count
      from public.parent_student_links psl
      where psl.parent_id = p.id;
    if child_count = 0 then
      return jsonb_build_object('state','needs_child','next_action','connect_child','destination','/parent/students');
    end if;
    return jsonb_build_object('state','ready','next_action','none','destination','/parent');
  end if;

  return jsonb_build_object('state','unknown_role','next_action','contact_support','destination','/auth/error?reason=role_unresolved');
end;
$$;

revoke all on function public.get_my_onboarding_state() from public, anon;
grant execute on function public.get_my_onboarding_state() to authenticated, service_role;

comment on function public.claim_my_initial_role(text) is
  'Claims an allowlisted self-service role exactly once for the authenticated profile. Existing database role always wins; never use URL/OAuth metadata as authority.';
comment on function public.get_my_role() is
  'Returns only the canonical profile role. School membership is not an account-role fallback.';
comment on function public.handle_new_user() is
  'Creates an unclassified profile. User-editable auth metadata is never accepted as authorization role.';
comment on function public.ensure_school_member() is
  'Creates derived teacher school membership only when the canonical profile role is teacher.';
comment on function public.get_my_onboarding_state() is
  'Canonical authenticated routing contract for role, account state and onboarding completeness.';
