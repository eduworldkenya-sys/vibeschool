-- Task 3: every student self-service surface resolves through one canonical contract.
-- students_one_active_profile_uidx already makes the mapping unique at rest;
-- current_student_id() additionally fails closed if integrity is ever violated.

create or replace function public.funhub_get_student_id()
returns uuid
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select public.current_student_id();
$function$;

revoke all on function public.funhub_get_student_id() from public,anon;
grant execute on function public.funhub_get_student_id() to authenticated,service_role;
