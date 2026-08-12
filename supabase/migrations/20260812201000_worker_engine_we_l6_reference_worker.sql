-- Worker Engine WE-L6: deterministic reference Operations Worker bootstrap.
-- No automatic production activation: bootstrap requires explicit service-role invocation.

create or replace function public.hq_workforce_bootstrap_reference_operations_worker(p_worker_key text default 'operations_reference_v1')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_bp uuid; v_cc uuid; v_tool uuid;
begin
 if exists(select 1 from public.hq_workforce_workers where worker_key=p_worker_key) then raise exception 'reference_worker_already_exists'; end if;
 insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
 values(p_worker_key,'digital','Reference Operations Worker','operations','Safely triage bounded HQ work items','draft','deterministic',false);
 insert into public.hq_workforce_blueprints(blueprint_key,version,title,mission,authority_ceiling,required_capabilities,status,approved_at)
 values(p_worker_key||'_bp',1,'Reference Operations Blueprint','Bounded deterministic operations','["work_item.triage"]'::jsonb,'["work_item.triage"]'::jsonb,'approved',now()) returning id into v_bp;
 insert into public.hq_workforce_creation_contracts(contract_key,worker_key,blueprint_id,authority_ceiling,expires_at)
 values(p_worker_key||'_creation',p_worker_key,v_bp,'["work_item.triage"]'::jsonb,now()+interval '30 days') returning id into v_cc;
 perform public.hq_workforce_transition_worker(p_worker_key,'requested','reference bootstrap',null);
 perform public.hq_workforce_transition_worker(p_worker_key,'instantiated','reference bootstrap',v_cc);
 perform public.hq_workforce_transition_worker(p_worker_key,'provisioned','reference bootstrap',v_cc);
 perform public.hq_workforce_transition_worker(p_worker_key,'shadow','reference bootstrap',v_cc);
 insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
 values(p_worker_key||'_triage',1,'Reference triage tool','work_item.triage_and_own','work_item.triage','update','hq_work_items','internal_write','approved',now()) returning id into v_tool;
 return jsonb_build_object('worker_key',p_worker_key,'blueprint_id',v_bp,'creation_contract_id',v_cc,'tool_contract_id',v_tool,'state','shadow');
end $$;

revoke all on function public.hq_workforce_bootstrap_reference_operations_worker(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_bootstrap_reference_operations_worker(text) to service_role;
