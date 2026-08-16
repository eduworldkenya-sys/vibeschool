-- Worker Engine production-readiness hardening: R1.4 Control Room read model.
-- NON-ACTIVATING and read-only. No operational control/mutation gateway is introduced.

alter function public.hq_workforce_get_control_room_snapshot(integer)
  rename to hq_workforce_get_control_room_snapshot_r1_3;
revoke all on function public.hq_workforce_get_control_room_snapshot_r1_3(integer) from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_get_control_room_snapshot(p_recent_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_base jsonb;
  v_r14 jsonb;
  lim integer:=greatest(1,least(coalesce(p_recent_limit,30),100));
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'control_room_authenticated_owner_required'; end if;
  v_base:=public.hq_workforce_get_control_room_snapshot_r1_3(lim);

  select jsonb_build_object(
    'executions',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select e.id as execution_id,e.task_id,e.created_at,t.worker_key,t.capability_key,t.capability_version,
               t.autonomous_authority_grant_id as authority_grant_id,t.plan_step_id,
               i.id as execution_intent_id,i.status as intent_status,i.verification_status,i.blocked_at,
               (select o.classification from public.hq_workforce_execution_outcomes o where o.task_id=t.id order by o.created_at desc limit 1) as outcome,
               (select count(*) from public.hq_workforce_execution_escalations es where es.task_id=t.id) as escalation_count,
               (select count(*) from public.hq_workforce_execution_breaker_events be where be.task_id=t.id and be.event_kind='execution_blocked') as breaker_block_count,
               (public.hq_workforce_get_execution_dossier(e.id)->'completeness') as evidence_completeness
        from public.hq_workforce_execution_envelopes e
        join public.hq_workforce_task_contracts t on t.id=e.task_id
        left join public.hq_workforce_execution_intents i on i.task_id=t.id
        order by e.created_at desc limit lim
      ) x
    ),'[]'::jsonb),
    'safety',jsonb_build_object(
      'active_authority_grants',(select count(*) from public.hq_workforce_capability_authority_grants where status='active'),
      'active_runtime_policies',(select count(*) from public.hq_workforce_runtime_policies where status='active' and enabled),
      'assigned_verifiers',(select count(*) from public.hq_workforce_verifier_assignments where status='assigned' and expires_at>clock_timestamp()),
      'tripped_breakers',(select count(*) from public.hq_workforce_execution_breakers where status='tripped'),
      'open_execution_alerts',(select count(*) from public.hq_workforce_monitoring_alerts where status='open' and subject_type='execution')
    ),
    'exceptions',jsonb_build_object(
      'failed_verifications',coalesce((select jsonb_agg(to_jsonb(x) order by x.verified_at desc) from (select * from public.hq_workforce_execution_verifications where not passed order by verified_at desc limit lim) x),'[]'::jsonb),
      'compensation_conflicts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.hq_workforce_execution_compensations where outcome<>'compensated' order by created_at desc limit lim) x),'[]'::jsonb),
      'escalations',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.hq_workforce_execution_escalations order by created_at desc limit lim) x),'[]'::jsonb),
      'execution_alerts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.hq_workforce_monitoring_alerts where subject_type='execution' and status='open' order by created_at desc limit lim) x),'[]'::jsonb)
    ),
    'operations',jsonb_build_object(
      'execution_count',(select count(*) from public.hq_workforce_execution_envelopes),
      'committed_count',(select count(*) from public.hq_workforce_execution_intents where status='committed'),
      'blocked_count',(select count(*) from public.hq_workforce_execution_intents where status='blocked'),
      'verification_passed',(select count(*) from public.hq_workforce_execution_verifications where passed),
      'verification_failed',(select count(*) from public.hq_workforce_execution_verifications where not passed),
      'compensated_count',(select count(*) from public.hq_workforce_execution_compensations where outcome='compensated'),
      'escalation_count',(select count(*) from public.hq_workforce_execution_escalations),
      'breaker_trip_count',(select count(*) from public.hq_workforce_execution_breaker_events where event_kind='tripped'),
      'breaker_block_count',(select count(*) from public.hq_workforce_execution_breaker_events where event_kind='execution_blocked')
    )
  ) into v_r14;

  return coalesce(v_base,'{}'::jsonb)||jsonb_build_object('r1_4',v_r14);
end $$;

revoke all on function public.hq_workforce_get_control_room_snapshot(integer) from public,anon,service_role;
grant execute on function public.hq_workforce_get_control_room_snapshot(integer) to authenticated;

-- Control Room upgrade cannot activate the engine.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'control room migration changed runtime boundary';
  end if;
end $$;
