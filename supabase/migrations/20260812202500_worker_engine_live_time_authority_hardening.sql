-- Live authority must use wall-clock time, not transaction-stable now().
create or replace function public.hq_workforce_assert_identity(p_worker_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 select id into v_id from public.hq_workforce_identities where worker_key=p_worker_key and status='active' and expires_at>clock_timestamp() order by issued_at desc limit 1;
 if v_id is null then raise exception 'worker_identity_invalid_or_revoked'; end if;
 return v_id;
end $$;

create or replace function public.hq_workforce_assert_certification(p_worker_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 select id into v_id from public.hq_workforce_certifications where worker_key=p_worker_key and status='active' and expires_at>clock_timestamp() order by issued_at desc limit 1;
 if v_id is null then raise exception 'worker_certification_invalid'; end if;
 return v_id;
end $$;

create or replace function public.hq_workforce_assert_capability(p_worker_key text,p_capability_key text,p_operation text,p_resource_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 perform public.hq_workforce_assert_identity(p_worker_key);
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
 select id into v_id from public.hq_workforce_capability_grants where worker_key=p_worker_key and capability_key=p_capability_key and operation=p_operation and resource_type=p_resource_type and status='active' and expires_at>clock_timestamp() order by granted_at desc limit 1;
 if v_id is null then raise exception 'worker_capability_denied'; end if;
 return v_id;
end $$;

create or replace function public.hq_workforce_reserve_budget(p_worker_key text,p_budget_key text,p_amount bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_now timestamptz:=clock_timestamp();
begin
 if p_amount<=0 then raise exception 'budget_reservation_must_be_positive'; end if;
 perform public.hq_workforce_assert_identity(p_worker_key);
 update public.hq_workforce_execution_budgets set reserved_amount=reserved_amount+p_amount,
   status=case when consumed_amount+reserved_amount+p_amount=limit_amount then 'exhausted' else status end
 where worker_key=p_worker_key and budget_key=p_budget_key and status='active' and v_now>=period_start and v_now<period_end and consumed_amount+reserved_amount+p_amount<=limit_amount
 returning id into v_id;
 if v_id is null then raise exception 'worker_budget_exhausted_or_missing'; end if;
 return v_id;
end $$;

create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_task_contracts%rowtype; tc public.hq_workforce_tool_contracts%rowtype; cap public.hq_workforce_capability_grants%rowtype; budget_id uuid; work_item_id uuid; result jsonb;
begin
 select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if t.status<>'running' then raise exception 'task_not_running'; end if;
 perform public.hq_workforce_assert_identity(t.worker_key); perform public.hq_workforce_assert_certification(t.worker_key);
 if public.hq_workforce_current_lifecycle_state(t.worker_key)<>'active' then raise exception 'worker_not_active'; end if;
 select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved'; if not found then raise exception 'tool_contract_not_approved'; end if;
 if tc.required_capability_key<>t.capability_key or tc.operation<>t.operation or tc.resource_type<>t.resource_type then raise exception 'task_tool_contract_mismatch'; end if;
 select * into cap from public.hq_workforce_capability_grants where worker_key=t.worker_key and capability_key=t.capability_key and operation=t.operation and resource_type=t.resource_type and status='active' and expires_at>clock_timestamp() order by granted_at desc limit 1;
 if not found then raise exception 'worker_capability_denied'; end if;
 if cap.scope_type<>t.scope_type or cap.scope_ref<>t.scope_ref then raise exception 'task_scope_denied'; end if;
 budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
 begin
  if tc.handler_key='work_item.triage_and_own' then
   work_item_id:=nullif(t.payload->>'work_item_id','')::uuid; if work_item_id is null then raise exception 'work_item_id_required'; end if;
   update public.hq_work_items set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id),acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress' where id=work_item_id and status='open';
   if not found then raise exception 'work_item_not_open_or_missing'; end if;
   result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'side_effect','hq_work_items.updated');
  else raise exception 'tool_handler_not_allowlisted'; end if;
  perform public.hq_workforce_consume_budget(budget_id,t.budget_amount); return result;
 exception when others then perform public.hq_workforce_release_budget(budget_id,t.budget_amount); raise; end;
end $$;
