-- Task 3: repository parity for production parent -> canonical learner helper.
-- This helper already exists in production but was absent from the clean migration
-- chain. Reconstruct it explicitly so learner-domain policies do not depend on
-- hidden production-only state.

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1
    from public.parent_student_links psl
    where psl.student_id=p_student_id
      and psl.parent_id=auth.uid()
      and coalesce(psl.access_level,'full')<>'none'
  );
$function$;

revoke all on function public.is_parent_of_student(uuid) from public,anon;
grant execute on function public.is_parent_of_student(uuid) to authenticated,service_role;
