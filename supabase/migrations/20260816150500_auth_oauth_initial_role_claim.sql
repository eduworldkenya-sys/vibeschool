begin;

-- OAuth providers cannot receive arbitrary app role metadata during the provider callback.
-- Permit a newly-created authenticated Google identity to claim a non-privileged
-- onboarding role exactly once. Existing profile authority always wins.
create or replace function public.claim_initial_oauth_role(p_requested_role text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_created_at timestamptz;
  v_provider text;
  v_role text;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_requested_role not in ('teacher', 'parent', 'global_user') then
    raise exception 'unsupported onboarding role';
  end if;

  select u.created_at, u.raw_app_meta_data->>'provider'
    into v_created_at, v_provider
  from auth.users u
  where u.id = v_uid;

  if v_created_at is null
     or v_created_at < now() - interval '10 minutes'
     or v_provider is distinct from 'google' then
    raise exception 'initial oauth role claim window closed';
  end if;

  update public.profiles p
  set role = p_requested_role
  where p.id = v_uid
    and p.role is null
    and p.account_status::text = 'active'
    and not p.is_anonymized
  returning p.role into v_role;

  if v_role is null then
    select p.role into v_role
    from public.profiles p
    where p.id = v_uid;
  end if;

  -- Idempotent replay is allowed only when it agrees with the already-claimed role.
  if v_role is distinct from p_requested_role then
    raise exception 'profile role already established';
  end if;

  return v_role;
end;
$$;

revoke all on function public.claim_initial_oauth_role(text) from public;
revoke all on function public.claim_initial_oauth_role(text) from anon;
grant execute on function public.claim_initial_oauth_role(text) to authenticated;
grant execute on function public.claim_initial_oauth_role(text) to service_role;

commit;
