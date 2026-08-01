begin;

-- P0: privileged mutation RPCs must never inherit PostgreSQL's default
-- EXECUTE grant to PUBLIC. Keep signed-in application access where the
-- current product flow requires it, but remove anonymous access explicitly.

revoke execute on function public.admin_add_student(text, text, text, text, uuid, uuid) from public, anon;
revoke execute on function public.teacher_add_student(text, text, uuid, uuid) from public, anon;
revoke execute on function public.create_child_for_parent(text, date, uuid) from public, anon;
revoke execute on function public.create_school_with_admin(uuid, text, text, text, text) from public, anon;
revoke execute on function public.join_school_as_admin(uuid, text, uuid) from public, anon;
revoke execute on function public.onboard_teacher_class(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.purchase_credits(uuid, integer, text) from public, anon;
revoke execute on function public.purchase_credits(uuid, uuid, text) from public, anon;
revoke execute on function public.spend_credit(uuid, text, integer, text) from public, anon;

-- Preserve only the signed-in and backend roles required by existing flows.
grant execute on function public.admin_add_student(text, text, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.teacher_add_student(text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.create_child_for_parent(text, date, uuid) to authenticated, service_role;
grant execute on function public.create_school_with_admin(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.join_school_as_admin(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.onboard_teacher_class(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.purchase_credits(uuid, integer, text) to authenticated, service_role;
grant execute on function public.purchase_credits(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.spend_credit(uuid, text, integer, text) to authenticated, service_role;

-- Internal maintenance functions are backend-only.
revoke execute on function public.fn_nightly_maintenance() from public, anon, authenticated;
revoke execute on function public.fn_write_health_log(uuid, text, text, integer, text, text, numeric) from public, anon, authenticated;
grant execute on function public.fn_nightly_maintenance() to service_role;
grant execute on function public.fn_write_health_log(uuid, text, text, integer, text, text, numeric) to service_role;

-- Prevent object-shadowing through caller-controlled search paths.
alter function public.admin_add_student(text, text, text, text, uuid, uuid)
  set search_path = public, pg_temp;
alter function public.teacher_add_student(text, text, uuid, uuid)
  set search_path = public, pg_temp;
alter function public.create_child_for_parent(text, date, uuid)
  set search_path = public, pg_temp;
alter function public.create_school_with_admin(uuid, text, text, text, text)
  set search_path = public, pg_temp;
alter function public.join_school_as_admin(uuid, text, uuid)
  set search_path = public, pg_temp;
alter function public.onboard_teacher_class(uuid, uuid, text, text, text)
  set search_path = public, pg_temp;
alter function public.purchase_credits(uuid, integer, text)
  set search_path = public, pg_temp;
alter function public.purchase_credits(uuid, uuid, text)
  set search_path = public, pg_temp;
alter function public.spend_credit(uuid, text, integer, text)
  set search_path = public, pg_temp;
alter function public.fn_nightly_maintenance()
  set search_path = public, pg_temp;
alter function public.fn_write_health_log(uuid, text, text, integer, text, text, numeric)
  set search_path = public, pg_temp;

commit;
