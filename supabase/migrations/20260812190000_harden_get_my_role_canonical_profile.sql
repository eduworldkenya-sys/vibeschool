create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() limit 1),
    (select sm.role::text from public.school_members sm where sm.profile_id = auth.uid() limit 1)
  );
$function$;

revoke execute on function public.get_my_role() from anon;
grant execute on function public.get_my_role() to authenticated;
