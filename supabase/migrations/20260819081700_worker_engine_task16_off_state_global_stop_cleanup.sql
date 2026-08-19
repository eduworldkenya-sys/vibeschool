-- TASK 16: if a global breaker is tripped while runtime is already OFF, fail closed
-- further by revoking any staged active authority before it can be reused later.

create or replace function public.hq_workforce_fail_closed_off_state_authority_cleanup()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_global_stop boolean:=false;
  v_grant_ids uuid[]:=array[]::uuid[];
  v_revoked integer:=0;
  v_remaining integer:=0;
  v_contained integer:=0;
  v_new_version bigint;
  v_event_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('worker-engine|task16|runtime-transition',0));
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_global_stop;

  if not v_global_stop or ec.runtime_state<>'OFF' or ec.runtime_execution_enabled or ec.runtime_activation_envelope_id is not null then
    return jsonb_build_object('status','no_action','transitioned',false,'runtime_state',ec.runtime_state,'runtime_state_version',ec.runtime_state_version);
  end if;

  select coalesce(array_agg(id),array[]::uuid[]),count(*)::integer into v_grant_ids,v_revoked
    from public.hq_workforce_capability_authority_grants where status='active';
  if v_revoked=0 then
    return jsonb_build_object('status','safe_off','transitioned',false,'runtime_state_version',ec.runtime_state_version,'global_stop_active',true);
  end if;

  update public.hq_workforce_capability_authority_grants set
    status='revoked',revoked_at=clock_timestamp(),revocation_reason='off_state_global_stop_cleanup',
    lifecycle_reason='off_state_global_stop_cleanup',
    lifecycle_evidence=coalesce(lifecycle_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'event','off_state_global_stop_revocation','at',clock_timestamp(),'reason','off_state_global_stop_cleanup'
    ))
  where id=any(v_grant_ids) and status='active';

  update public.hq_workforce_task_contracts t set
    status=case when t.status='running' and exists(
      select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
    ) then 'failed' else 'cancelled' end,
    completed_at=clock_timestamp(),lease_expires_at=null,
    last_error=case when t.status='running' and exists(
      select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
    ) then 'runtime_shutdown_post_commit_verification_required' else 'off_state_global_stop_contained' end,
    execution_evidence=coalesce(t.execution_evidence,'{}'::jsonb)||jsonb_build_object(
      'off_state_global_stop',jsonb_build_object('at',clock_timestamp(),'reason','off_state_global_stop_cleanup')
    )
  where t.autonomous_authority_grant_id=any(v_grant_ids) and t.status in ('queued','running');
  get diagnostics v_contained=row_count;

  select count(*) into v_remaining from public.hq_workforce_capability_authority_grants where status='active';
  if v_remaining<>0 then raise exception 'off_state_global_stop_authority_cleanup_failed'; end if;

  v_new_version:=ec.runtime_state_version+1;
  update public.hq_workforce_engine_contract set
    runtime_state_version=v_new_version,
    runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
    runtime_max_concurrency=1,runtime_max_executions_per_minute=1,
    heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true,
    updated_at=clock_timestamp()
  where singleton=true;

  insert into public.hq_workforce_runtime_transition_events(
    actor_id,actor_kind,idempotency_key,action,previous_state,resulting_state,previous_version,resulting_version,
    requested_envelope,authority_revoked_count,jobs_contained_count,outcome,reason,evidence
  ) values(
    null,'system','off-global-stop-cleanup:'||ec.runtime_state_version::text,
    'global_stop','OFF','OFF',ec.runtime_state_version,v_new_version,'{}'::jsonb,
    v_revoked,v_contained,'applied','off_state_global_stop_cleanup',
    jsonb_build_object('global_stop_active',true,'authority_cleanup_remaining_active',v_remaining)
  ) returning id into v_event_id;

  return jsonb_build_object(
    'status','failed_closed','transitioned',true,'runtime_state','OFF','runtime_state_version',v_new_version,
    'authority_revoked_count',v_revoked,'jobs_contained_count',v_contained,'event_id',v_event_id
  );
end $$;

create or replace function public.hq_workforce_scheduled_bounded_runtime_queue()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_off_cleanup jsonb; v_watchdog jsonb; v_queue jsonb;
begin
  v_off_cleanup:=public.hq_workforce_fail_closed_off_state_authority_cleanup();
  v_watchdog:=public.hq_workforce_fail_closed_runtime_watchdog();
  v_queue:=public.hq_workforce_execute_bounded_runtime_queue(10,120);
  return coalesce(v_queue,'{}'::jsonb)||jsonb_build_object('off_state_global_stop_cleanup',v_off_cleanup,'runtime_watchdog',v_watchdog);
exception when others then
  return jsonb_build_object('status','failed_closed','error',sqlerrm,'processed',0,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_fail_closed_off_state_authority_cleanup() from public,anon,authenticated;
grant execute on function public.hq_workforce_fail_closed_off_state_authority_cleanup() to service_role;
