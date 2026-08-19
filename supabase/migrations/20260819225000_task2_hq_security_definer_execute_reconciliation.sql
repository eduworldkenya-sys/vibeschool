-- Task 2: reconcile HQ SECURITY DEFINER execute privileges with the current
-- production security posture during deterministic clean reconstruction.
--
-- The clean repository replay exposed six HQ SECURITY DEFINER functions whose
-- implicit/default PUBLIC EXECUTE grant made them callable by anon. Production
-- already has those PUBLIC/anon grants removed. This forward migration records
-- that security truth without mutating production during branch certification.

begin;

-- Owner-facing HQ functions. Keep authenticated access because each function
-- performs its own owner/authority checks; service_role remains available for
-- governed platform operation. Revoke PUBLIC first because anon inherits PUBLIC.
revoke execute on function public.hq_complete_emergency_recovery(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.hq_complete_emergency_recovery(uuid, uuid, text)
  to authenticated, service_role;

revoke execute on function public.hq_get_goal_progress()
  from public, anon, authenticated;
grant execute on function public.hq_get_goal_progress()
  to authenticated, service_role;

revoke execute on function public.hq_get_product_config(text, text)
  from public, anon, authenticated;
grant execute on function public.hq_get_product_config(text, text)
  to authenticated, service_role;

revoke execute on function public.hq_resolve_incident(uuid, text)
  from public, anon, authenticated;
grant execute on function public.hq_resolve_incident(uuid, text)
  to authenticated, service_role;

revoke execute on function public.hq_run_company_intelligence()
  from public, anon, authenticated;
grant execute on function public.hq_run_company_intelligence()
  to authenticated, service_role;

-- Emergency control is deliberately service-role only in production. Do not
-- widen it to authenticated merely because the function contains internal
-- assertions: the execute privilege itself is part of the control-plane boundary.
revoke execute on function public.hq_emergency_control(text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.hq_emergency_control(text, text, jsonb, text)
  to service_role;

commit;
