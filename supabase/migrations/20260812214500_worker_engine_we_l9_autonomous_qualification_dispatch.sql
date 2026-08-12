-- Worker Engine WE-L9: autonomous qualification + generic governed dispatch.
-- Separate governance qualification from worker creation; creator never self-certifies.
-- access: service-only public.hq_workforce_factory_qualification_cases
-- authorization-test: public.hq_workforce_factory_qualification_cases anon/authenticated denied; service_role only.

alter table public.hq_workforce_factory_templates add column if not exists tool_call_budget bigint not null default 20 check(tool_call_budget between 1 and 10000);
alter table public.hq_workforce_factory_templates add column if not exists certification_days integer not null default 30 check(certification_days between 1 and 365);

create table public.hq_workforce_factory_qualification_cases (
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.hq_workforce_factory_templates(id) on delete restrict,
 case_key text not null,
 input_snapshot jsonb not null,
 expected_outcome jsonb not null,
 status text not null default 'approved' check(status in ('approved','superseded','revoked')),
 approved_at timestamptz not null default clock_timestamp(),
 unique(template_id,case_key)
);

insert into public.hq_workforce_factory_qualification_cases(template_id,case_key,input_snapshot,expected_outcome)
select t.id,v.case_key,v.input_snapshot,v.expected_outcome
from public.hq_workforce_factory_templates t
cross join (values
 ('triage_normal','{"priority":"normal","approval_required":false}'::jsonb,'{"decision":"triage"}'::jsonb),
 ('triage_high','{"priority":"high","approval_required":false}'::jsonb,'{"decision":"triage"}'::jsonb),
 ('triage_critical','{"priority":"critical","approval_required":false}'::jsonb,'{"decision":"triage"}'::jsonb)
) v(case_key,input_snapshot,expected_outcome)
where t.template_key='operations_capacity_triage' and t.version=1
on conflict(template_id,case_key) do nothing;

create or replace function public.hq_workforce_execute_shadow_tool(p_tool_contract_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_tool_contracts%rowtype;
begin
 select * into t from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved'; if not found then raise exception 'approved_shadow_tool_required'; end if;
 if t.handler_key='work_item.triage_and_own' then
   if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if;
   return jsonb_build_object('decision','triage');
 end if;
 raise exception 'shadow_handler_not_certified';
end $$;

create or replace function public.hq_workforce_qualify_factory_workers(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; t public.hq_workforce_factory_templates%rowtype; c record; v_observed jsonb; v_passed int; v_qualified int:=0; v_failed int:=0; v_identity_key text;
begin
 if p_limit<1 or p_limit>50 then raise exception 'invalid_qualification_limit'; end if;
 for r in
   select fr.*,de.lane_key,gs.signal_type
   from public.hq_workforce_factory_runs fr
   join public.hq_workforce_demand_evidence de on de.id=fr.demand_evidence_id
   join public.hq_workforce_gap_signals gs on gs.id=de.gap_id
   where fr.decision='create_digital_worker_probation' and fr.worker_key is not null
     and public.hq_workforce_current_lifecycle_state(fr.worker_key)='shadow'
   order by fr.created_at for update of fr skip locked limit p_limit
 loop
   select * into t from public.hq_workforce_factory_templates ft
    where ft.lane_key=r.lane_key and ft.signal_type=r.signal_type and ft.status='approved'
      and exists(select 1 from public.hq_workforce_tool_contracts tc where tc.id=r.tool_contract_id and tc.required_capability_key=ft.capability_key and tc.operation=ft.operation and tc.resource_type=ft.resource_type)
    order by ft.version desc limit 1;
   if not found then v_failed:=v_failed+1; continue; end if;
   v_passed:=0;
   for c in select * from public.hq_workforce_factory_qualification_cases qc where qc.template_id=t.id and qc.status='approved' order by qc.case_key loop
     v_observed:=public.hq_workforce_execute_shadow_tool(r.tool_contract_id,c.input_snapshot);
     perform public.hq_workforce_record_shadow_run(r.worker_key,r.tool_contract_id,c.input_snapshot,c.expected_outcome,v_observed,'governance_factory_verifier_v1');
     if v_observed=c.expected_outcome then v_passed:=v_passed+1; end if;
   end loop;
   if v_passed<3 then v_failed:=v_failed+1; continue; end if;
   perform public.hq_workforce_transition_worker(r.worker_key,'certification_pending','governance qualification suite passed',r.creation_contract_id);
   perform public.hq_workforce_issue_certification(r.worker_key,r.creation_contract_id,'governance_factory_verifier_v1',v_passed,make_interval(days=>t.certification_days));
   perform public.hq_workforce_transition_worker(r.worker_key,'certified','independent governance certification issued',r.creation_contract_id);
   perform public.hq_workforce_transition_worker(r.worker_key,'active','certified factory worker activated',r.creation_contract_id);
   v_identity_key:=r.worker_key||':identity:'||gen_random_uuid()::text;
   insert into public.hq_workforce_identities(worker_key,identity_key,expires_at) values(r.worker_key,v_identity_key,clock_timestamp()+make_interval(days=>t.certification_days));
   insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,scope_type,scope_ref,granted_by_contract_id,expires_at)
   values(r.worker_key,t.capability_key,t.operation,t.resource_type,t.scope_type,t.scope_ref,r.creation_contract_id,clock_timestamp()+make_interval(days=>t.certification_days));
   insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end)
   values(r.worker_key,'tool_calls','tool_call',t.tool_call_budget,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 day');
   v_qualified:=v_qualified+1;
 end loop;
 return jsonb_build_object('qualified',v_qualified,'failed',v_failed,'verifier','governance_factory_verifier_v1','mode','deterministic');
end $$;

create or replace function public.hq_workforce_detect_operations_tasks(p_limit integer default 20)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare wi record; v_worker text; v_tool uuid; n int:=0;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_detection_limit'; end if;
 for wi in
   select id from public.hq_work_items
   where department_key='operations' and status='open' and approval_required=false and coalesce(action_taken,'{}'::jsonb)='{}'::jsonb
   order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,created_at limit p_limit
 loop
   select w.worker_key,tc.id into v_worker,v_tool
   from public.hq_workforce_workers w
   join public.hq_workforce_identities i on i.worker_key=w.worker_key and i.status='active' and i.expires_at>clock_timestamp()
   join public.hq_workforce_certifications cert on cert.worker_key=w.worker_key and cert.status='active' and cert.expires_at>clock_timestamp()
   join public.hq_workforce_capability_grants cg on cg.worker_key=w.worker_key and cg.capability_key='work_item.triage' and cg.operation='update' and cg.resource_type='hq_work_items' and cg.scope_type='platform_internal' and cg.status='active' and cg.expires_at>clock_timestamp()
   join public.hq_workforce_tool_contracts tc on tc.tool_key=w.worker_key||'_triage' and tc.required_capability_key='work_item.triage' and tc.status='approved'
   where public.hq_workforce_current_lifecycle_state(w.worker_key)='active'
     and exists(select 1 from public.hq_workforce_execution_budgets b where b.worker_key=w.worker_key and b.budget_key='tool_calls' and b.status='active' and clock_timestamp()>=b.period_start and clock_timestamp()<b.period_end and b.consumed_amount+b.reserved_amount<b.limit_amount)
   order by (select count(*) from public.hq_workforce_task_contracts q where q.worker_key=w.worker_key and q.status in ('queued','running')),w.worker_key
   limit 1;
   if v_worker is null then exit; end if;
   insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,max_attempts)
   values('ops:'||wi.id::text,v_worker,v_tool,'work_item.triage','update','hq_work_items','platform_internal','{}'::jsonb,jsonb_build_object('work_item_id',wi.id),'ops:'||wi.id::text,'tool_calls',3)
   on conflict(idempotency_key) do nothing;
   if found then n:=n+1; end if;
 end loop;
 return n;
end $$;

create or replace function public.hq_workforce_autonomous_heartbeat(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_key text; v_detected int:=0; v_processed int:=0; v_verified int:=0; v_failed int:=0; r record; v_ver uuid; v_pass boolean; v_result jsonb;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_heartbeat_limit'; end if;
 v_key:='heartbeat:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'); insert into public.hq_workforce_heartbeat_runs(heartbeat_key) values(v_key);
 v_detected:=public.hq_workforce_detect_operations_tasks(p_limit);
 v_processed:=public.hq_workforce_execute_task_queue(p_limit,60);
 for r in select id,worker_key from public.hq_workforce_task_contracts where status='completed' and verification_status='pending' order by completed_at limit p_limit loop
   begin v_ver:=public.hq_workforce_verify_task(r.id,'governance_task_verifier_v1'); select passed into v_pass from public.hq_workforce_task_verifications where id=v_ver; if v_pass then v_verified:=v_verified+1; else v_failed:=v_failed+1; end if; exception when others then v_failed:=v_failed+1; end;
 end loop;
 v_result:=jsonb_build_object('heartbeat_key',v_key,'detected',v_detected,'processed',v_processed,'verified',v_verified,'failed_verifications',v_failed,'mode','deterministic','worker_selection','generic_capability_routing');
 update public.hq_workforce_heartbeat_runs set completed_at=clock_timestamp(),tasks_processed=v_processed,tasks_failed=v_failed,result=v_result where heartbeat_key=v_key; return v_result;
end $$;

create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hb boolean; v_factory boolean; v_hb_limit integer; v_factory_limit integer; v_factory_result jsonb; v_qual_result jsonb; v_runtime_result jsonb;
begin
 select heartbeat_enabled,factory_enabled,heartbeat_limit,factory_limit into v_hb,v_factory,v_hb_limit,v_factory_limit from public.hq_workforce_engine_contract where singleton=true;
 if not coalesce(v_hb,false) and not coalesce(v_factory,false) then return jsonb_build_object('status','disabled','mode','deterministic'); end if;
 if coalesce(v_factory,false) then v_factory_result:=public.hq_workforce_autonomous_factory_heartbeat(coalesce(v_factory_limit,10)); v_qual_result:=public.hq_workforce_qualify_factory_workers(coalesce(v_factory_limit,10)); else v_factory_result:='{"status":"disabled"}'::jsonb; v_qual_result:='{"status":"disabled"}'::jsonb; end if;
 if coalesce(v_hb,false) then v_runtime_result:=public.hq_workforce_autonomous_heartbeat(coalesce(v_hb_limit,20)); else v_runtime_result:='{"status":"disabled"}'::jsonb; end if;
 return jsonb_build_object('factory',v_factory_result,'qualification',v_qual_result,'runtime',v_runtime_result,'mode','deterministic');
end $$;

create or replace function public.hq_workforce_guard_factory_qualification_case_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin if tg_op='DELETE' then raise exception 'factory_qualification_case_delete_forbidden'; end if; if new is distinct from old then raise exception 'factory_qualification_case_immutable'; end if; return new; end $$;
create trigger trg_hq_workforce_guard_factory_qualification_case_mutation before update or delete on public.hq_workforce_factory_qualification_cases for each row execute function public.hq_workforce_guard_factory_qualification_case_mutation();

alter table public.hq_workforce_factory_qualification_cases enable row level security;
revoke all on table public.hq_workforce_factory_qualification_cases from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_factory_qualification_cases to service_role;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb),public.hq_workforce_qualify_factory_workers(integer),public.hq_workforce_detect_operations_tasks(integer),public.hq_workforce_autonomous_heartbeat(integer),public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_factory_qualification_case_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb),public.hq_workforce_qualify_factory_workers(integer),public.hq_workforce_detect_operations_tasks(integer),public.hq_workforce_autonomous_heartbeat(integer),public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_factory_qualification_case_mutation() to service_role;
