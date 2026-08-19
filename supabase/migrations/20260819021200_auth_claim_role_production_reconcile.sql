begin;

create or replace function public.claim_my_initial_role(p_role text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current_role text;
  v_status text;
  v_anonymized boolean;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('teacher','parent','global_user') then
    raise exception 'role_not_self_service' using errcode='22023';
  end if;

  select p.role, p.account_status::text, p.is_anonymized
    into v_current_role, v_status, v_anonymized
  from public.profiles p
  where p.id=v_uid
  for update;

  if not found then raise exception 'profile_missing' using errcode='P0002'; end if;
  if v_status is distinct from 'active' or coalesce(v_anonymized,false) then
    raise exception 'account_not_active' using errcode='42501';
  end if;
  if v_current_role is not null then return v_current_role; end if;

  update public.profiles
  set role=p_role, updated_at=now()
  where id=v_uid and role is null;

  select role into v_current_role from public.profiles where id=v_uid;
  return v_current_role;
end;
$$;
revoke all on function public.claim_my_initial_role(text) from public, anon;
grant execute on function public.claim_my_initial_role(text) to authenticated;

create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user='authenticated' and (
       new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.is_anonymized is distinct from old.is_anonymized
    or new.school_id is distinct from old.school_id
  ) then
    raise exception 'profile_authority_fields_are_read_only' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_authority_fields() from public, anon, authenticated;
drop trigger if exists guard_profile_authority_fields on public.profiles;
create trigger guard_profile_authority_fields
before update on public.profiles
for each row execute function public.guard_profile_authority_fields();

comment on function public.claim_my_initial_role(text) is
  'One-time allowlisted self-service role claim. Existing canonical role always wins.';
comment on function public.guard_profile_authority_fields() is
  'Defense-in-depth guard preventing direct authenticated mutation of profile authority fields.';

notify pgrst, 'reload schema';
commit;
