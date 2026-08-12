-- Worker Engine reference-loop hardening: detection -> governed execution -> independent verification.
-- access: service-only public.hq_workforce_task_verifications
-- authorization-test: public.hq_workforce_task_verifications anon/authenticated denied; service_role only.

alter table public.hq_workforce_task_contracts
  add column if not exists verification_status text not null default 'pending'
  check (verification_status in ('pending','verified','failed'));

create table if not exists public.hq_workforce_task_verifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  verifier_key text not null,
  expected_outcome jsonb not null,
  observed_outcome jsonb not null,
  passed boolean not null,
  verified_at timestamptz not null default now()
);

create or replace function public.hq_workforce_verify_task(p_task_id uuid,p_verifier_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_task_contracts%rowtype; wi public.hq_work_items%rowtype; v_id uuid; v_expected jsonb; v_observed jsonb; v_pass boolean;
begin
 if coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
 select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if t.status<>'completed' then raise exception 'task_not_completed'; end if;
 if t.verification_status<>'pending' then raise exception 'task_already_verified'; end if;
 if t.resource_type<>'hq_work_items' or t.operation<>'update' then raise exception 'unsupported_task_verification_contract'; end if;
 select * into wi from public.hq_work_items where id=nullif(t.payload->>'work_item_id','')::uuid;
 if not found then raise exception 'verification_resource_not_found'; end if;
 v_expected:=jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id::text);
 v_observed:=jsonb_build_object('worker_key',wi.action_taken->>'worker_key','action',wi.action_taken->>'action','task_id',wi.action_taken->>'task_id');
 v_pass:=v_expected=v_observed;
 insert into public.hq_workforce_task_verifications(task_id,verifier_key,expected_outcome,observed_outcome,passed)
 values(t.id,p_verifier_key,v_expected,v_observed,v_pass) returning id into v_id;
 update public.hq_workforce_task_contracts set verification_status=case when v_pass then 'verified' else 'failed' end where id=t.id;
 update public.hq_work_items set verification_status=case when v_pass then 'verified' else 'failed' end,
   verification_evidence=jsonb_build_object('task_id',t.id,'verifier_key',p_verifier_key,'expected',v_expected,'observed',v_observed),
   status=case when v_pass then 'resolved' else status end,
   resolved_at=case when v_pass then coalesce(resolved_at,now()) else resolved_at end
 where id=wi.id;
 if not v_pass then raise exception 'task_outcome_verification_failed'; end if;
 return v_id;
end $$;

create or replace function public.hq_workforce_detect_reference_operations_tasks(p_worker_key text default 'operations_reference_v1',p_limit integer default 20)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tool uuid; r record; n integer:=0;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_detection_limit'; end if;
 perform public.hq_workforce_assert_identity(p_worker_key);
 perform public.hq_workforce_assert_certification(p_worker_key);
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
 select id into v_tool from public.hq_workforce_tool_contracts where tool_key=p_worker_key||'_triage' and status='approved' order by version desc limit 1;
 if v_tool is null then raise exception 'reference_tool_not_found'; end if;
 for r in select id from public.hq_work_items
   where department_key='operations' and status='open' and approval_required=false
     and coalesce(action_taken,'{}'::jsonb)='{}'::jsonb
   order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,created_at
   limit p_limit
 loop
   insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,payload,idempotency_key,budget_key,max_attempts)
   values('ops:'||r.id::text,p_worker_key,v_tool,'work_item.triage','update','hq_work_items','platform_internal',jsonb_build_object('work_item_id',r.id),'ops:'||r.id::text,'tool_calls',3)
   on conflict(idempotency_key) do nothing;
   if found then n:=n+1; end if;
 end loop;
 return n;
end $$;

create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_task_contracts%rowtype; tc public.hq_workforce_tool_contracts%rowtype; cap public.hq_workforce_capability_grants%rowtype; budget_id uuid; work_item_id uuid; result jsonb;
begin
 select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if t.status<>'running' then raise exception 'task_not_running'; end if;
 perform public.hq_workforce_assert_identity(t.worker_key);
 perform public.hq_workforce_assert_certification(t.worker_key);
 if public.hq_workforce_current_lifecycle_state(t.worker_key)<>'active' then raise exception 'worker_not_active'; end if;
 select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
 if not found then raise exception 'tool_contract_not_approved'; end if;
 if tc.required_capability_key<>t.capability_key or tc.operation<>t.operation or tc.resource_type<>t.resource_type then raise exception 'task_tool_contract_mismatch'; end if;
 select * into cap from public.hq_workforce_capability_grants where worker_key=t.worker_key and capability_key=t.capability_key and operation=t.operation and resource_type=t.resource_type and status='active' and expires_at>now() order by granted_at desc limit 1;
 if not found then raise exception 'worker_capability_denied'; end if;
 if cap.scope_type<>t.scope_type or cap.scope_ref<>t.scope_ref then raise exception 'task_scope_denied'; end if;
 budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
 begin
   if tc.handler_key='work_item.triage_and_own' then
     work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
     if work_item_id is null then raise exception 'work_item_id_required'; end if;
     update public.hq_work_items set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id),acted_at=coalesce(acted_at,now()),updated_at=now(),status='in_progress' where id=work_item_id and status='open';
     if not found then raise exception 'work_item_not_open_or_missing'; end if;
     result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'side_effect','hq_work_items.updated');
   else raise exception 'tool_handler_not_allowlisted'; end if;
   perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
   return result;
 exception when others then perform public.hq_workforce_release_budget(budget_id,t.budget_amount); raise; end;
end $$;

create or replace function public.hq_workforce_autonomous_heartbeat(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_key text; v_detected int:=0; v_processed int:=0; v_verified int:=0; v_failed int:=0; r record; v_result jsonb;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_heartbeat_limit'; end if;
 v_key:='heartbeat:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
 insert into public.hq_workforce_heartbeat_runs(heartbeat_key) values(v_key);
 begin v_detected:=public.hq_workforce_detect_reference_operations_tasks('operations_reference_v1',p_limit); exception when others then v_detected:=0; end;
 v_processed:=public.hq_workforce_execute_task_queue(p_limit,60);
 for r in select id from public.hq_workforce_task_contracts where worker_key='operations_reference_v1' and status='completed' and verification_status='pending' order by completed_at limit p_limit
 loop
   begin perform public.hq_workforce_verify_task(r.id,'deterministic_reference_verifier_v1'); v_verified:=v_verified+1; exception when others then v_failed:=v_failed+1; end;
 end loop;
 select count(*) into v_failed from public.hq_workforce_task_contracts where status='dead_letter' and created_at>=now()-interval '5 minutes';
 v_result:=jsonb_build_object('heartbeat_key',v_key,'detected',v_detected,'processed',v_processed,'verified',v_verified,'recent_dead_letters',v_failed,'mode','deterministic');
 update public.hq_workforce_heartbeat_runs set completed_at=now(),tasks_processed=v_processed,tasks_failed=v_failed,result=v_result where heartbeat_key=v_key;
 return v_result;
end $$;

alter table public.hq_workforce_task_verifications enable row level security;
revoke all on table public.hq_workforce_task_verifications from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_task_verifications to service_role;
revoke all on function public.hq_workforce_verify_task(uuid,text),public.hq_workforce_detect_reference_operations_tasks(text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_task(uuid,text),public.hq_workforce_detect_reference_operations_tasks(text,integer) to service_role;
