-- Worker Engine certification coverage hardening.
-- A worker certification must prove fresh, server-executed shadow coverage for every
-- capability declared by its creation blueprint. Run count alone is insufficient.
-- NON-ACTIVATING.

create or replace function public.hq_workforce_issue_certification(
  p_worker_key text,
  p_creation_contract_id uuid,
  p_verifier_key text,
  p_required integer default 3,
  p_valid_for interval default interval '30 days'
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_passed integer;
  v_id uuid;
  v_since timestamptz;
  v_issued timestamptz;
  v_contract public.hq_workforce_creation_contracts%rowtype;
  v_blueprint public.hq_workforce_blueprints%rowtype;
  v_missing text[];
begin
  if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'certification_pending' then
    raise exception 'worker_not_certification_pending';
  end if;
  if p_verifier_key=p_worker_key or coalesce(trim(p_verifier_key),'')='' then
    raise exception 'independent_verifier_required';
  end if;
  if p_required<3 then raise exception 'minimum_three_shadow_runs'; end if;
  if p_valid_for<=interval '0 seconds' then raise exception 'certification_validity_required'; end if;

  select * into v_contract
  from public.hq_workforce_creation_contracts
  where id=p_creation_contract_id
    and worker_key=p_worker_key
    and status in ('issued','consumed')
    and (expires_at is null or expires_at>clock_timestamp());
  if not found then raise exception 'valid_creation_contract_required_for_certification'; end if;

  select * into v_blueprint
  from public.hq_workforce_blueprints
  where id=v_contract.blueprint_id and status='approved';
  if not found then raise exception 'approved_blueprint_required_for_certification'; end if;
  if jsonb_typeof(v_blueprint.required_capabilities)<>'array'
     or jsonb_array_length(v_blueprint.required_capabilities)=0 then
    raise exception 'blueprint_required_capabilities_missing';
  end if;

  select coalesce(max(issued_at),'-infinity'::timestamptz)
    into v_since
  from public.hq_workforce_certifications
  where worker_key=p_worker_key;

  select count(*) into v_passed
  from public.hq_workforce_shadow_runs sr
  where sr.worker_key=p_worker_key
    and sr.passed
    and not sr.side_effects_applied
    and sr.verifier_key=p_verifier_key
    and sr.execution_method='server_shadow_executor_v2'
    and sr.executed_at>v_since;
  if v_passed<p_required then raise exception 'insufficient_fresh_server_verified_shadow_runs'; end if;

  select array_agg(req.capability_key order by req.capability_key)
    into v_missing
  from (
    select jsonb_array_elements_text(v_blueprint.required_capabilities) capability_key
  ) req
  where not exists (
    select 1
    from public.hq_workforce_shadow_runs sr
    join public.hq_workforce_tool_contracts tc
      on tc.id=sr.tool_contract_id and tc.status='approved'
    where sr.worker_key=p_worker_key
      and sr.passed
      and not sr.side_effects_applied
      and sr.verifier_key=p_verifier_key
      and sr.execution_method='server_shadow_executor_v2'
      and sr.executed_at>v_since
      and tc.required_capability_key=req.capability_key
  );
  if coalesce(array_length(v_missing,1),0)>0 then
    raise exception 'certification_missing_blueprint_capability_shadow_coverage:%',array_to_string(v_missing,',');
  end if;

  v_issued:=clock_timestamp();
  insert into public.hq_workforce_certifications(
    worker_key,creation_contract_id,certification_key,status,required_shadow_runs,
    passed_shadow_runs,verifier_key,issued_at,expires_at
  ) values(
    p_worker_key,p_creation_contract_id,p_worker_key||':'||gen_random_uuid()::text,'active',
    p_required,v_passed,p_verifier_key,v_issued,v_issued+p_valid_for
  ) returning id into v_id;
  return v_id;
end $$;

-- Model calls must respect the worker-level paid-AI permission, not just token budgets.
create or replace function public.hq_workforce_authorize_model_call(
  p_worker_key text,
  p_task_id uuid,
  p_reason_code text,
  p_failure_evidence jsonb,
  p_model_key text,
  p_token_budget bigint
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid;
  v_budget uuid;
  t public.hq_workforce_task_contracts%rowtype;
  w public.hq_workforce_workers%rowtype;
begin
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found then raise exception 'worker_not_found'; end if;
  if not coalesce(w.paid_ai_allowed,false) then raise exception 'worker_paid_ai_not_allowed'; end if;
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
  insert into public.hq_workforce_model_invocations(
    worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,
    model_key,token_budget,status,budget_id
  ) values(
    p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,
    p_model_key,p_token_budget,'authorized',v_budget
  ) returning id into v_id;
  return v_id;
end $$;

-- Installation must remain fail-closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'certification_coverage_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'certification_coverage_violated_fail_closed_runtime';
  end if;
  select count(*) into v_active
  from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'certification_coverage_cannot_activate_authority'; end if;
end $$;
