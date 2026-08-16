begin;

create or replace function public.get_my_auth_access_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object('authenticated', false, 'role', null, 'account_status', null, 'is_anonymized', false)
    else
      coalesce(
        (
          select jsonb_build_object(
            'authenticated', true,
            'role', p.role,
            'account_status', p.account_status::text,
            'is_anonymized', p.is_anonymized,
            'profile_complete', p.role is not null
          )
          from public.profiles p
          where p.id = auth.uid()
          limit 1
        ),
        jsonb_build_object(
          'authenticated', true,
          'role', null,
          'account_status', null,
          'is_anonymized', false,
          'profile_complete', false
        )
      )
  end;
$$;

revoke all on function public.get_my_auth_access_state() from public;
revoke all on function public.get_my_auth_access_state() from anon;
grant execute on function public.get_my_auth_access_state() to authenticated;
grant execute on function public.get_my_auth_access_state() to service_role;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case
    when p.account_status::text = 'active'
      and not p.is_anonymized
      and p.role in ('teacher','parent','student','admin','global_user')
    then p.role
    else null
  end
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_role() from public;
revoke all on function public.get_my_role() from anon;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_my_role() to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_role text;
  v_safe_role text;
begin
  v_requested_role := nullif(new.raw_user_meta_data->>'role', '');
  v_safe_role := case
    when v_requested_role in ('teacher','parent','student','global_user') then v_requested_role
    else null
  end;

  insert into public.profiles (id, full_name, role, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_safe_role,
    'active'::account_status
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  begin
    insert into public.signup_provisioning_failures (user_id, email, attempted_role, error_message)
    values (new.id, new.email, v_requested_role, sqlerrm);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and school_id is not distinct from (select p.school_id from public.profiles p where p.id = auth.uid())
  and role is not distinct from (select p.role from public.profiles p where p.id = auth.uid())
  and account_status is not distinct from (select p.account_status from public.profiles p where p.id = auth.uid())
);

drop policy if exists allow_own_profile_read on public.profiles;
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

commit;
