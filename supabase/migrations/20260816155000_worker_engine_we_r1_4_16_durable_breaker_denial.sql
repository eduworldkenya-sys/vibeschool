-- WE-R1.4.16: durable circuit-breaker denial evidence.
-- NON-ACTIVATING. A tripped breaker remains a prohibition. The attempted execution runs
-- inside a subtransaction; on breaker denial that subtransaction is rolled back, then a
-- durable execution_blocked event is written outside it. Queue dispatch treats the deny
-- result as terminal failure, never success and never an automatic retry storm.

-- Preserve the approval-bound canonical gateway as an inaccessible inner implementation.
alter function public.hq_workforce_consequential_execution_gateway(uuid)
  rename to hq_workforce_consequential_execution_gateway_r14_approval_bound_internal;

create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_result jsonb;
  v_err text;
  v_scope_type text;
  v_scope_ref text;
  v_breaker public.hq_workforce_execution_breakers%rowtype;
  t public.hq_workforce_task_contracts%rowtype;
begin
  -- This block is a PL/pgSQL subtransaction. Any reservation, mutation, budget change,
  -- authority binding, or non-durable breaker event created by the inner gateway is
  -- rolled back before the exception handler executes.
  begin
    v_result:=public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(p_task_id);
    return v_result;
  exception when others then
    v_err:=sqlerrm;
    if v_err not like 'execution_circuit_breaker_tripped:%' then
      raise;
    end if;
  end;

  -- Standardized R1.4.8 error shape is execution_circuit_breaker_tripped:<scope>:<ref>.
  v_scope_type:=split_part(v_err,':',2);
  v_scope_ref:=split_part(v_err,':',3);
  if v_scope_type not in ('global','capability','authority_grant') or nullif(btrim(v_scope_ref),'') is null then
    raise exception 'breaker_denial_error_shape_invalid:%',v_err;
  end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found_after_breaker_denial'; end if;

  -- Reacquire the exact scope lock before recording the durable denial. This proves the
  -- referenced breaker is still authoritative at the evidence boundary.
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|'||v_scope_type||'|'||v_scope_ref,0));
  select * into v_breaker
    from public.hq_workforce_execution_breakers
   where scope_type=v_scope_type and scope_ref=v_scope_ref and status='tripped'
   order by created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'breaker_changed_during_denial_recording:%:%',v_scope_type,v_scope_ref;
  end if;

  insert into public.hq_workforce_execution_breaker_events(
    breaker_id,event_kind,task_id,authority_grant_id,capability_key,actor,reason_code,evidence
  ) values(
    v_breaker.id,'execution_blocked',t.id,t.autonomous_authority_grant_id,t.capability_key,
    'worker-engine',v_breaker.reason_code,
    jsonb_build_object(
      'durable_after_execution_rollback',true,
      'scope_type',v_scope_type,
      'scope_ref',v_scope_ref,
      'original_error',v_err,
      'authority_effect','deny',
      'mutation_performed',false
    )
  );

  return jsonb_build_object(
    'decision','deny',
    'reason','circuit_breaker',
    'task_id',t.id,
    'breaker_id',v_breaker.id,
    'scope_type',v_scope_type,
    'scope_ref',v_scope_ref,
    'mutation_performed',false,
    'retry_automatic',false
  );
end $$;

-- Queue semantics must understand an explicit deny result. A breaker-denied task is
-- terminally failed and requires an explicit new/recovery action after operator reset;
-- it is not completed and is not automatically retried against the same prohibition.
create or replace function public.hq_workforce_execute_task_queue(p_limit integer default 20,p_lease_seconds integer default 60)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r record;
  n integer:=0;
  evidence jsonb;
  err text;
  v_enabled boolean;
  v_paused boolean;
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_queue_limit'; end if;
  if p_lease_seconds<10 or p_lease_seconds>3600 then raise exception 'invalid_lease_seconds'; end if;
  select runtime_execution_enabled,runtime_anomaly_paused into v_enabled,v_paused
    from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_enabled,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  update public.hq_workforce_task_contracts
     set status='queued',lease_expires_at=null,
         last_error=coalesce(last_error,'')||case when last_error is null then '' else '; ' end||'lease_expired'
   where status='running' and lease_expires_at<clock_timestamp();

  for r in
    select id from public.hq_workforce_task_contracts
     where status='queued' and next_attempt_at<=clock_timestamp()
     order by created_at
     for update skip locked limit p_limit
  loop
    update public.hq_workforce_task_contracts
       set status='running',attempt_count=attempt_count+1,
           started_at=coalesce(started_at,clock_timestamp()),
           lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds)
     where id=r.id;

    begin
      evidence:=public.hq_workforce_tool_gateway_execute(r.id);

      if coalesce(evidence->>'decision','allow')='deny' then
        update public.hq_workforce_task_contracts
           set status='failed',completed_at=null,lease_expires_at=null,
               execution_evidence=evidence,
               last_error='execution_denied:'||coalesce(evidence->>'reason','unspecified')
         where id=r.id;
      else
        update public.hq_workforce_task_contracts
           set status='completed',completed_at=clock_timestamp(),lease_expires_at=null,
               execution_evidence=evidence,last_error=null
         where id=r.id;
      end if;
    exception when others then
      err:=sqlerrm;
      update public.hq_workforce_task_contracts
         set status=case when attempt_count>=max_attempts then 'dead_letter' else 'queued' end,
             next_attempt_at=case when attempt_count>=max_attempts then next_attempt_at
                                  else clock_timestamp()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
             lease_expires_at=null,last_error=err
       where id=r.id;
      insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
      select id,worker_key,'EXECUTION_FAILED',err,attempt_count,payload
        from public.hq_workforce_task_contracts where id=r.id and status='dead_letter'
      on conflict(task_id) do update
        set error_detail=excluded.error_detail,attempts=excluded.attempts,
            payload_snapshot=excluded.payload_snapshot,created_at=clock_timestamp();
    end;
    n:=n+1;
  end loop;
  return n;
end $$;

revoke all on function public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid)
  from public,anon,authenticated;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
revoke all on function public.hq_workforce_execute_task_queue(integer,integer)
  from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_task_queue(integer,integer) to service_role;

-- NON-ACTIVATION + durable-denial structural attestation.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.16 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.16 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.16 cannot install with active capability authority'; end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE') then
    raise exception 'WE-R1.4.16 inner gateway externally callable';
  end if;
end $$;
