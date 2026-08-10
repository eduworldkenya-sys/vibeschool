-- Keep role resolution working when a legacy/auth user is temporarily missing
-- a profiles row. Prefer the canonical profile role, then school membership,
-- then signup metadata as a last-resort compatibility fallback.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() limit 1),
    (select sm.role::text from public.school_members sm where sm.profile_id = auth.uid() limit 1),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', '')
  );
$$;

revoke all on function public.get_my_role() from public;
grant execute on function public.get_my_role() to authenticated;
