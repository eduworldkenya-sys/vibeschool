-- Reference-loop governance hardening.

create or replace function public.hq_workforce_guard_task_contract_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'worker_task_contract_delete_forbidden'; end if;
  if (new.task_key,new.schema_version,new.worker_key,new.tool_contract_id,new.capability_key,new.operation,new.resource_type,new.scope_type,new.scope_ref,new.payload,new.idempotency_key,new.budget_key,new.budget_amount,new.max_attempts,new.created_at)
     is distinct from
     (old.task_key,old.schema_version,old.worker_key,old.tool_contract_id,old.capability_key,old.operation,old.resource_type,old.scope_type,old.scope_ref,old.payload,old.idempotency_key,old.budget_key,old.budget_amount,old.max_attempts,old.created_at) then
    raise exception 'worker_task_contract_immutable';
  end if;
  return new;
end $$;
drop trigger if exists trg_hq_workforce_guard_task_contract_mutation on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_guard_task_contract_mutation before update or delete on public.hq_workforce_task_contracts for each row execute function public.hq_workforce_guard_task_contract_mutation();

create or replace function public.hq_workforce_revoke_certification(p_worker_key text,p_reason text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
  if coalesce(trim(p_reason),'')='' then raise exception 'certification_revocation_reason_required'; end if;
  update public.hq_workforce_certifications set status='revoked',revoked_at=now(),revocation_reason=p_reason where worker_key=p_worker_key and status='active';
  get diagnostics n=row_count;
  return n;
end $$;

create or replace function public.hq_workforce_suspend_for_remediation(p_worker_key text,p_reason text,p_creation_contract_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
  perform public.hq_workforce_revoke_certification(p_worker_key,p_reason);
  perform public.hq_workforce_revoke_identity(p_worker_key,p_reason);
  perform public.hq_workforce_transition_worker(p_worker_key,'suspended',p_reason,p_creation_contract_id);
  perform public.hq_workforce_transition_worker(p_worker_key,'remediation',p_reason,p_creation_contract_id);
  return 'remediation';
end $$;

alter table public.hq_workforce_model_invocations add column if not exists budget_id uuid references public.hq_workforce_execution_budgets(id) on delete restrict;
alter table public.hq_workforce_model_invocations add column if not exists completed_at timestamptz;

create or replace function public.hq_workforce_authorize_model_call(p_worker_key text,p_task_id uuid,p_reason_code text,p_failure_evidence jsonb,p_model_key text,p_token_budget bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_budget uuid; t public.hq_workforce_task_contracts%rowtype;
begin
  perform public.hq_workforce_assert_identity(p_worker_key);
  perform public.hq_workforce_assert_certification(p_worker_key);
  if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
  if p_reason_code not in ('semantic_ambiguity','unstructured_synthesis','novel_classification') then raise exception 'model_reason_not_allowlisted'; end if;
  if coalesce(p_failure_evidence,'{}'::jsonb)='{}'::jsonb then raise exception 'deterministic_failure_evidence_required'; end if;
  if p_token_budget<1 then raise exception 'model_token_budget_required'; end if;
  if p_task_id is not null then
    select * into t from public.hq_workforce_task_contracts where id=p_task_id;
    if not found or t.worker_key<>p_worker_key then raise exception 'model_task_worker_mismatch'; end if;
  end if;
  v_budget:=public.hq_workforce_reserve_budget(p_worker_key,'model_tokens',p_token_budget);
  insert into public.hq_workforce_model_invocations(worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,model_key,token_budget,status,budget_id)
  values(p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,p_model_key,p_token_budget,'authorized',v_budget) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_finalize_model_call(p_invocation_id uuid,p_success boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.hq_workforce_model_invocations%rowtype;
begin
  select * into i from public.hq_workforce_model_invocations where id=p_invocation_id for update;
  if not found then raise exception 'model_invocation_not_found'; end if;
  if i.status<>'authorized' then raise exception 'model_invocation_not_pending'; end if;
  if p_success then
    perform public.hq_workforce_consume_budget(i.budget_id,i.token_budget);
    update public.hq_workforce_model_invocations set status='completed',completed_at=now() where id=i.id;
    return 'completed';
  else
    perform public.hq_workforce_release_budget(i.budget_id,i.token_budget);
    update public.hq_workforce_model_invocations set status='failed',completed_at=now() where id=i.id;
    return 'failed';
  end if;
end $$;

revoke all on function public.hq_workforce_guard_task_contract_mutation(),public.hq_workforce_revoke_certification(text,text),public.hq_workforce_suspend_for_remediation(text,text,uuid),public.hq_workforce_finalize_model_call(uuid,boolean) from public,anon,authenticated;
grant execute on function public.hq_workforce_guard_task_contract_mutation(),public.hq_workforce_revoke_certification(text,text),public.hq_workforce_suspend_for_remediation(text,text,uuid),public.hq_workforce_finalize_model_call(uuid,boolean) to service_role;
