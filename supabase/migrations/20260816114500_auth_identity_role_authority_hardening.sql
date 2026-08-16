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

  -- Existing role is immutable through this entrypoint. This makes OAuth replay,
  -- sign-in through the wrong role URL and callback retry idempotent.
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

comment on function public.claim_my_initial_role(text) is
  'Claims an allowlisted self-service role exactly once for the authenticated profile. Existing database role always wins; never use URL/OAuth metadata as authority.';
comment on function public.get_my_role() is
  'Returns only the canonical profile role. School membership is not an account-role fallback.';
comment on function public.handle_new_user() is
  'Creates an unclassified profile. User-editable auth metadata is never accepted as authorization role.';
