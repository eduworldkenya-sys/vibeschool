-- WE-R1.4.10 adversarial certification for the bounded priority canary.
-- Earlier R1.4 suites continue to exercise authority expiry/version/scope, idempotency,
-- verification, compensation, budgets/concurrency and breakers. This suite proves the
-- newly wired canary cannot widen that chain or create a second mutation gateway.
begin;

-- Canonical contracts must exist and production-style activation must remain absent.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'R1.4.10 changed fail-closed engine posture';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.10 introduced active authority'; end if;
  if exists(select 1 from public.hq_workforce_canary_queue_memberships) then raise exception 'R1.4.10 admitted a persistent canary target'; end if;
end $$;

-- Ordinary product roles cannot touch queue admission or any consequential control surface.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_canary_queue_memberships','SELECT')
       or has_table_privilege(r,'public.hq_workforce_canary_queue_memberships','INSERT')
       or has_table_privilege(r,'public.hq_workforce_canary_queue_memberships','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_canary_queue_memberships','DELETE') then
      raise exception 'unexpected canary membership privilege for %',r;
    end if;
    if has_function_privilege(r,'public.hq_workforce_consequential_execution_gateway(uuid)','EXECUTE')
       or has_function_privilege(r,'public.hq_workforce_verify_consequential_execution(uuid,text)','EXECUTE')
       or has_function_privilege(r,'public.hq_workforce_compensate_consequential_execution(uuid,text,text)','EXECUTE') then
      raise exception 'unexpected canary control execution privilege for %',r;
    end if;
  end loop;
  -- Legacy helper implementations remain internal/non-callable after canonicalization.
  if has_function_privilege('service_role','public.hq_workforce_verify_priority_canary(uuid,text)','EXECUTE') then raise exception 'service_role bypasses canonical verifier'; end if;
  if has_function_privilege('service_role','public.hq_workforce_compensate_priority_canary(uuid,text,text)','EXECUTE') then raise exception 'service_role bypasses canonical compensation'; end if;
end $$;

-- The canonical gateway must carry every inherited safety participant plus canary-specific bounds.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('hq_workforce_assert_consequential_task_authorized' in d)=0 then raise exception 'authority intersection bypassed'; end if;
  if position('hq_workforce_reserve_execution_intent' in d)=0 then raise exception 'idempotency reservation bypassed'; end if;
  if position('hq_workforce_assert_execution_not_stopped' in d)=0 then raise exception 'breaker inheritance bypassed'; end if;
  if position('hq_workforce_reserve_capability_execution' in d)=0 then raise exception 'capability budget/rate/concurrency bypassed'; end if;
  if position('hq_workforce_commit_execution_intent' in d)=0 then raise exception 'intent commit evidence missing'; end if;
  if position('m.work_item_id=work_item_id' in d)=0 then raise exception 'exact membership target binding missing'; end if;
  if position('queue_key=''worker_engine_internal''' in d)=0 then raise exception 'internal queue boundary missing'; end if;
  if position('jsonb_object_length(v_desired)<>1' in d)=0 then raise exception 'priority-only desired-state shape missing'; end if;
  if position('update public.hq_work_items set priority=v_priority where id=work_item_id' in d)=0 then raise exception 'priority-only mutation not explicit'; end if;
  if position('records_affected'',1' in d)=0 then raise exception 'single-record evidence missing'; end if;
end $$;

-- Canary verification and compensation must be embedded in canonical entrypoints, not delegated
-- to separately executable mutation/recovery gateways.
do $$
declare vd text; cd text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into vd;
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into cd;
  if position('internal.work_queue.prioritize' in vd)=0 or position('update_priority' in vd)=0
     or position('v_is_priority_canary' in vd)=0 then raise exception 'canonical verifier missing canary branch'; end if;
  if position('worker_cannot_verify_own_execution' in vd)=0
     or position('verification_execution_intent_not_committed' in vd)=0
     or position('verification_contract_missing' in vd)=0 then raise exception 'canonical verifier lost inherited verification gates'; end if;
  if position('internal.work_queue.prioritize' in cd)=0 or position('update_priority' in cd)=0
     or position('v_is_priority_canary' in cd)=0 then raise exception 'canonical compensation missing canary branch'; end if;
  if position('compensation_requires_failed_verification' in cd)=0
     or position('compensation_recovery_snapshot_missing' in cd)=0
     or position('compare-and-compensate' in cd)=0 then raise exception 'canonical compensation lost inherited recovery gates'; end if;
end $$;

-- Independent verification must bind expected priority AND continued queue admission.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into d;
  if position('worker_cannot_verify_own_execution' in d)=0 then raise exception 'self-verification denial missing'; end if;
  if position('queue_member' in d)=0 or position('worker_engine_internal' in d)=0 then raise exception 'verifier queue-boundary check missing'; end if;
  if position('priority' in d)=0 or position('v_expected=v_observed' in d)=0 then raise exception 'exact priority verifier missing'; end if;
  if position('execution_intent_id' in d)=0 or position('authority_grant_id' in d)=0 or position('plan_step_id' in d)=0 then raise exception 'canary verification lineage incomplete'; end if;
end $$;

-- Compensation must compare the current priority before restoring the exact authoritative snapshot.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('current_priority_diverged' in d)=0 then raise exception 'human/process collision protection missing'; end if;
  if position('authoritative_before_state' in d)=0 or position('expected_after_state' in d)=0 then raise exception 'recovery snapshot lineage missing'; end if;
  if position('set priority=i.authoritative_before_state->>''priority''' in d)=0 then raise exception 'exact priority restore missing'; end if;
  if position('compensation_authority_lineage_mismatch' in d)=0 then raise exception 'compensation authority lineage gate missing'; end if;
end $$;

-- Missing authority/lineage and invented targets must fail closed rather than reach a mutation.
do $$
declare fake uuid:=gen_random_uuid();
begin
  begin
    perform public.hq_workforce_consequential_execution_gateway(fake);
    raise exception 'invented task reached gateway';
  exception when others then
    if sqlerrm='invented task reached gateway' then raise; end if;
    if sqlerrm<>'task_not_found' then raise exception 'unexpected invented-task failure: %',sqlerrm; end if;
  end;
  begin
    perform public.hq_workforce_verify_consequential_execution(fake,'independent-verifier');
    raise exception 'invented task reached verifier';
  exception when others then
    if sqlerrm='invented task reached verifier' then raise; end if;
  end;
  begin
    perform public.hq_workforce_compensate_consequential_execution(fake,'operator-review','adversarial test');
    raise exception 'invented task reached compensation';
  exception when others then
    if sqlerrm='invented task reached compensation' then raise; end if;
  end;
end $$;

-- R1.4.10 certification must remain an engineering proof, not activation.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4.10 test changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.10 test activated authority'; end if;
end $$;

rollback;
