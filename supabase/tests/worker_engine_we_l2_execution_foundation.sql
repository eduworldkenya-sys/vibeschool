-- WE-L2 acceptance suite. Disposable/local/preview DB only.
begin;

do $$
declare
  v_worker text:='we_l2_'||substr(gen_random_uuid()::text,1,8);
  v_bp uuid; v_cc uuid; v_tool uuid; v_work uuid; v_task uuid; v_budget uuid;
  v_count int; v_status text; v_action jsonb; v_reserved bigint;
begin
  insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
  values(v_worker,'digital','WE-L2 Test','operations','test','draft','deterministic',false);

  insert into public.hq_workforce_blueprints(blueprint_key,version,title,mission,authority_ceiling,status,approved_at)
  values(v_worker||'_bp',1,'bp','test','["work_item.triage"]'::jsonb,'approved',now()) returning id into v_bp;
  insert into public.hq_workforce_creation_contracts(contract_key,worker_key,blueprint_id,authority_ceiling,expires_at)
  values(v_worker||'_cc',v_worker,v_bp,'["work_item.triage"]'::jsonb,now()+interval '1 hour') returning id into v_cc;

  perform public.hq_workforce_transition_worker(v_worker,'requested','test',null);
  perform public.hq_workforce_transition_worker(v_worker,'instantiated','test',v_cc);
  perform public.hq_workforce_transition_worker(v_worker,'provisioned','test',v_cc);
  perform public.hq_workforce_transition_worker(v_worker,'shadow','test',v_cc);
  perform public.hq_workforce_transition_worker(v_worker,'certification_pending','test',v_cc);
  perform public.hq_workforce_transition_worker(v_worker,'certified','test',v_cc);
  perform public.hq_workforce_transition_worker(v_worker,'active','test',v_cc);

  insert into public.hq_workforce_identities(worker_key,identity_key,expires_at)
  values(v_worker,v_worker||'_id',now()+interval '1 hour');
  insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,granted_by_contract_id,expires_at)
  values(v_worker,'work_item.triage','update','hq_work_items',v_cc,now()+interval '1 hour');
  insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end)
  values(v_worker,'tool_calls','tool_call',3,now()-interval '1 minute',now()+interval '1 hour') returning id into v_budget;

  insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
  values(v_worker||'_tool',1,'triage','work_item.triage_and_own','work_item.triage','update','hq_work_items','internal_write','approved',now()) returning id into v_tool;
  insert into public.hq_work_items(department_key,work_type,title) values('operations','test','WE-L2 test item') returning id into v_work;
  insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,payload,idempotency_key,budget_key,max_attempts)
  values(v_worker||'_task',v_worker,v_tool,'work_item.triage','update','hq_work_items','platform_internal',jsonb_build_object('work_item_id',v_work),v_worker||'_idem','tool_calls',3) returning id into v_task;

  v_count:=public.hq_workforce_execute_task_queue(20,60);
  select status into v_status from public.hq_workforce_task_contracts where id=v_task;
  select action_taken into v_action from public.hq_work_items where id=v_work;
  if v_count<1 or v_status<>'completed' or v_action->>'task_id'<>v_task::text then raise exception 'TEST_FAIL: governed real execution did not complete'; end if;

  begin
    insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,payload,idempotency_key,budget_key)
    values(v_worker||'_dup',v_worker,v_tool,'work_item.triage','update','hq_work_items','platform_internal',jsonb_build_object('work_item_id',v_work),v_worker||'_idem','tool_calls');
    raise exception 'TEST_FAIL: duplicate idempotency accepted';
  exception when unique_violation then null;
  end;

  insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,payload,idempotency_key,budget_key,max_attempts)
  values(v_worker||'_bad',v_worker,v_tool,'work_item.triage','update','hq_work_items','platform_internal',jsonb_build_object('work_item_id',gen_random_uuid()),v_worker||'_badidem','tool_calls',1);
  perform public.hq_workforce_execute_task_queue(20,60);
  if not exists(select 1 from public.hq_workforce_task_contracts t join public.hq_workforce_dead_letters d on d.task_id=t.id where t.task_key=v_worker||'_bad' and t.status='dead_letter') then raise exception 'TEST_FAIL: failed task not dead-lettered'; end if;
  select reserved_amount into v_reserved from public.hq_workforce_execution_budgets where id=v_budget;
  if v_reserved<>0 then raise exception 'TEST_FAIL: failed call leaked budget reservation'; end if;
end $$;

rollback;
