-- Pilot certification: an admin-shaped profile is not authoritative without an
-- admin/owner school membership. Quarantine incomplete provisioning identities.
update public.profiles p
set account_status='restricted', updated_at=clock_timestamp()
where p.role='admin'
  and p.account_status='active'
  and not exists (
    select 1 from public.school_members sm
    where sm.profile_id=p.id and sm.role::text in ('admin','owner')
  );

create or replace function public.guard_admin_authority_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.role='admin' and new.account_status='active' then
    if not exists (
      select 1 from public.school_members sm
      where sm.profile_id=new.id and sm.role::text in ('admin','owner')
    ) then
      raise exception 'active_admin_requires_school_admin_membership';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.guard_admin_authority_state() from public,anon,authenticated;
grant execute on function public.guard_admin_authority_state() to service_role;

drop trigger if exists trg_guard_admin_authority_state on public.profiles;
create constraint trigger trg_guard_admin_authority_state
after insert or update of role,account_status on public.profiles
deferrable initially deferred
for each row execute function public.guard_admin_authority_state();

do $$ begin
 if exists (
   select 1 from public.profiles p
   where p.role='admin' and p.account_status='active'
     and not exists(select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner'))
 ) then raise exception 'active admin without authoritative membership remains'; end if;
end $$;
