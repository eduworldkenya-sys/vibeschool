begin;

-- profiles.school_id, role and account_status are authority attributes. RLS
-- correctly limits which row a user may update, but ordinary UPDATE policies do
-- not stop the owner of that row from changing those authority columns.
create or replace function public.guard_profile_authority_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  -- SECURITY DEFINER application/RPC code runs as postgres and is allowed to
  -- perform an authorized authority transition. Direct API clients run under
  -- the authenticator role and must never mutate these columns themselves.
  if current_user not in ('postgres','service_role') then
    if auth.uid() is null or auth.uid() <> old.id then
      raise exception 'unauthorized_identity';
    end if;
    if new.school_id is distinct from old.school_id then raise exception 'school_id_is_server_managed'; end if;
    if new.role is distinct from old.role then raise exception 'role_is_server_managed'; end if;
    if new.account_status is distinct from old.account_status then raise exception 'account_status_is_server_managed'; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_profile_authority_columns on public.profiles;
create trigger trg_guard_profile_authority_columns
before update on public.profiles
for each row execute function public.guard_profile_authority_columns();

-- A client may create its own profile, but cannot bootstrap itself into a
-- school or privileged role. Authorized RPCs perform the subsequent binding.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and school_id is null
  and role in ('teacher','student','parent')
  and account_status = 'active'
);

commit;
