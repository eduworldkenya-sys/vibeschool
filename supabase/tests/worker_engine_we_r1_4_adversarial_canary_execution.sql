-- WE-R1.4 adversarial canary recertification after production-closure hardening.
begin;

-- Activation must remain absent.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'closure changed fail-closed engine posture';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'closure introduced active authority'; end if;
  if exists(select 1 from public.hq_workforce_canary_queue_memberships) then raise exception 'persistent canary target exists'; end if;
end $$;

-- Ordinary product roles cannot touch consequential control surfaces.
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
      raise exception 'unexpected consequential control privilege for %',r;
    end if;
  end loop;
end $$;

-- Canonical execution is now a layered chain: durable-denial wrapper -> owner-approved
-- plan binding -> previously certified R1.4 mutation body. Internal layers are not service callable.
do $$
declare outer_d text; approval_d text; inner_d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into outer_d;
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)'::regprocedure)) into approval_d;
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)'::regprocedure)) into inner_d;

  if position('durable_after_execution_rollback' in outer_d)=0 or position('decision'',''deny' in outer_d)=0 then raise exception 'durable breaker denial wrapper missing'; end if;
  if position('hq_workforce_assert_approved_plan_binding' in approval_d)=0 then raise exception 'owner-approved plan binding missing'; end if;
  if position('hq_workforce_assert_consequential_task_authorized' in inner_d)=0 then raise exception 'authority intersection bypassed'; end if;
  if position('hq_workforce_reserve_execution_intent' in inner_d)=0 then raise exception 'idempotency reservation bypassed'; end if;
  if position('hq_workforce_assert_execution_not_stopped' in inner_d)=0 then raise exception 'breaker inheritance bypassed'; end if;
  if position('hq_workforce_reserve_capability_execution' in inner_d)=0 then raise exception 'capability limit reservation bypassed'; end if;
  if position('hq_workforce_commit_execution_intent' in inner_d)=0 then raise exception 'intent commit evidence missing'; end if;
  if position('m.work_item_id=work_item_id' in inner_d)=0 or position('queue_key=''worker_engine_internal''' in inner_d)=0 then raise exception 'exact canary membership binding missing'; end if;
  if position('jsonb_object_length(v_desired)<>1' in inner_d)=0 then raise exception 'priority-only desired state missing'; end if;
  if position('update public.hq_work_items set priority=v_priority where id=work_item_id' in inner_d)=0 then raise exception 'priority-only canary mutation missing'; end if;

  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)','EXECUTE') then
    raise exception 'service_role can bypass canonical execution wrapper';
  end if;
end $$;

-- Approved execution must be bound to an immutable fingerprint of the reviewed plan.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_approved_plan_binding(uuid)'::regprocedure)) into d;
  if position('approved_plan_id' in d)=0 or position('approved_plan_hash' in d)=0 then raise exception 'approved plan identity/hash missing'; end if;
  if position('approved_plan_definition_changed_after_review' in d)=0 then raise exception 'post-review plan mutation detector missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_objectives','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plans','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plan_steps','UPDATE') then
    raise exception 'service_role retains direct executable-planning truth writes';
  end if;
end $$;

-- Independent verification is a separate task/plan-step/worker assignment, not a label.
do $$
declare wrapper_d text; assign_d text; deterministic_d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into wrapper_d;
  select lower(pg_get_functiondef('public.hq_workforce_assign_independent_verifier(uuid,uuid)'::regprocedure)) into assign_d;
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)'::regprocedure)) into deterministic_d;
  if position('independent_verifier_assignment_required' in wrapper_d)=0 or position('verifier_identity_not_assignment_bound' in wrapper_d)=0 then raise exception 'verifier assignment boundary missing'; end if;
  if position('executor_and_verifier_worker_must_differ' in assign_d)=0 or position('role=''verification''' in assign_d)=0 then raise exception 'separation-of-duty verifier assignment incomplete'; end if;
  if position('internal.work_queue.prioritize' in deterministic_d)=0 or position('v_is_priority_canary' in deterministic_d)=0 then raise exception 'deterministic canary verifier missing'; end if;
  if position('queue_member' in deterministic_d)=0 or position('v_expected=v_observed' in deterministic_d)=0 then raise exception 'exact canary postcondition comparison missing'; end if;
  if has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE') then raise exception 'service_role bypasses verifier assignment'; end if;
end $$;

-- Compensation remains exact-state, lineage-bound recovery.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('internal.work_queue.prioritize' in d)=0 or position('v_is_priority_canary' in d)=0 then raise exception 'canonical compensation missing canary branch'; end if;
  if position('current_priority_diverged' in d)=0 then raise exception 'human/process collision protection missing'; end if;
  if position('authoritative_before_state' in d)=0 or position('expected_after_state' in d)=0 then raise exception 'recovery snapshot lineage missing'; end if;
  if position('compensation_authority_lineage_mismatch' in d)=0 then raise exception 'compensation authority lineage missing'; end if;
end $$;

-- Every hq_work_items update now advances a monotonic version clock and updated_at,
-- eliminating the previous priority A->B->A stale-snapshot hole.
do $$
declare d text;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_work_items' and column_name='worker_state_revision') then raise exception 'work item revision missing'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.hq_work_items'::regclass and tgname='trg_hq_workforce_advance_work_item_version' and not tgisinternal) then raise exception 'work item version trigger missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_advance_work_item_version()'::regprocedure)) into d;
  if position('old.worker_state_revision+1' in d)=0 or position('new.updated_at:=clock_timestamp()' in d)=0 then raise exception 'monotonic version clock incomplete'; end if;
end $$;

-- Queue runner must never convert a breaker denial into successful completion or retry storm.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_execute_task_queue(integer,integer)'::regprocedure)) into d;
  if position('evidence->>''decision''' in d)=0 or position('status=''failed''' in d)=0 then raise exception 'queue does not understand explicit deny'; end if;
  if position('execution_denied:' in d)=0 then raise exception 'queue denial evidence missing'; end if;
end $$;

-- Invented targets and unassigned verifiers fail closed.
do $$
declare fake uuid:=gen_random_uuid();
begin
  begin
    perform public.hq_workforce_consequential_execution_gateway(fake);
    raise exception 'invented task reached gateway';
  exception when others then
    if sqlerrm='invented task reached gateway' then raise; end if;
    if sqlerrm<>'task_not_found' then raise exception 'unexpected invented task failure:%',sqlerrm; end if;
  end;
  begin
    perform public.hq_workforce_verify_consequential_execution(fake,'independent-verifier');
    raise exception 'unassigned verifier accepted';
  exception when others then
    if sqlerrm='unassigned verifier accepted' then raise; end if;
    if sqlerrm<>'independent_verifier_assignment_required' then raise exception 'unexpected verifier failure:%',sqlerrm; end if;
  end;
end $$;

-- Final fail-closed assertion.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'test changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'test activated authority'; end if;
end $$;

rollback;
