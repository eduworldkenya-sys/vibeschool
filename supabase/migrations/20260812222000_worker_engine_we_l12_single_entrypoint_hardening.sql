-- WE-L12: single governed runtime entrypoint.
-- Low-level factory/qualification/dispatch primitives execute as function owner only.
-- service_role may invoke the scheduled control loop, not inject its own diagnosis path.

revoke all on function public.hq_workforce_seal_demand_evidence(uuid,jsonb) from service_role;
revoke all on function public.hq_workforce_factory_diagnose(uuid) from service_role;
revoke all on function public.hq_workforce_factory_create_shadow_worker(uuid,uuid,text,text,text,text,text,text,text,jsonb) from service_role;
revoke all on function public.hq_workforce_factory_cycle(uuid,jsonb,text,text,text,text,text,text) from service_role;
revoke all on function public.hq_workforce_authoritative_demand_metrics(uuid,uuid) from service_role;
revoke all on function public.hq_workforce_autonomous_factory_heartbeat(integer) from service_role;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from service_role;
revoke all on function public.hq_workforce_qualify_factory_workers(integer) from service_role;
revoke all on function public.hq_workforce_detect_operations_tasks(integer) from service_role;
revoke all on function public.hq_workforce_observe_demand_sensors() from service_role;
revoke all on function public.hq_workforce_autonomous_heartbeat(integer) from service_role;

-- Explicit external runtime boundary.
revoke all on function public.hq_workforce_scheduled_heartbeat() from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_scheduled_heartbeat() to service_role;

-- Configuration tables remain service-only but their approved rows are mechanically immutable.
-- Runtime evidence is never writable by anon/authenticated.
