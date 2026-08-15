-- WE-R1.4.10: preserve the complete R1.4.4 independent-verification contract inside
-- the canonical verifier while adding the priority canary as a narrow verification branch.
-- NON-ACTIVATING. Verification emits evidence only and cannot confer authority.
-- access: service-only public.hq_workforce_verify_consequential_execution
-- authorization-test: public/anon/authenticated cannot execute canonical verification.

create or replace function public.hq_workforce_verify_consequential_execution(
  p_task_id uuid,
  p_verifier_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  v_expected jsonb;
  v_observed jsonb;
  v_pass boolean:=false;
  v_id uuid;
  v_work_item_id uuid;
  v_is_priority_canary boolean:=false;
begin
  if char_length(btrim(coalesce(p_verifier_key,'')))<3 then raise exception 'independent_verifier_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'verification_task_not_found'; end if;
  if p_verifier_key=t.worker_key then raise exception 'worker_cannot_verify_own_execution'; end if;
  if t.status<>'completed' then raise exception 'verification_task_not_completed'; end if;
  if t.verification_status<>'pending' then raise exception 'verification_task_already_finalized'; end if;
  if t.autonomous_authority_grant_id is null or t.plan_step_id is null or t.capability_version is null then raise exception 'verification_task_lineage_missing'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'verification_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'verification_execution_intent_not_committed'; end if;
  if i.verification_status<>'pending' then raise exception 'verification_intent_already_finalized'; end if;
  if i.authority_grant_id is distinct from t.autonomous_authority_grant_id
     or i.plan_step_id is distinct from t.plan_step_id
     or i.capability_key is distinct from t.capability_key
     or i.capability_version is distinct from t.capability_version then
    raise exception 'verification_execution_lineage_mismatch';
  end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'verification_authority_missing'; end if;
  if not g.verification_required then raise exception 'verification_not_required_by_authority'; end if;
  if g.verification_contract='{}'::jsonb then raise exception 'verification_contract_missing'; end if;
  if g.capability_key is distinct from i.capability_key
     or g.capability_version is distinct from i.capability_version
     or g.operation is distinct from i.operation
     or g.resource_type is distinct from i.resource_type
     or g.scope_type is distinct from i.scope_type
     or g.scope_ref is distinct from i.scope_ref then
    raise exception 'verification_authority_lineage_mismatch';
  end if;

  v_work_item_id:=nullif(i.resource_identity->>'work_item_id','')::uuid;
  if v_work_item_id is null then raise exception 'verification_resource_identity_missing'; end if;

  v_is_priority_canary :=
    t.capability_key='internal.work_queue.prioritize'
    and t.capability_version=1
    and t.operation='update_priority'
    and t.resource_type='hq_work_items'
    and t.scope_type='platform_internal';

  if v_is_priority_canary then
    if not (i.expected_after_state ? 'priority') or jsonb_object_length(i.expected_after_state)<>1 then
      raise exception 'priority_canary_verification_expected_state_invalid';
    end if;
    select * into wi from public.hq_work_items where id=v_work_item_id;
    v_expected:=jsonb_build_object(
      'resource_exists',true,
      'queue_member',true,
      'priority',i.expected_after_state->>'priority',
      'execution_intent_id',i.id::text,
      'authority_grant_id',i.authority_grant_id::text,
      'plan_step_id',i.plan_step_id::text
    );
    if not found then
      v_observed:=jsonb_build_object(
        'resource_exists',false,
        'queue_member',false,
        'priority',null,
        'execution_intent_id',i.id::text,
        'authority_grant_id',i.authority_grant_id::text,
        'plan_step_id',i.plan_step_id::text
      );
    else
      v_observed:=jsonb_build_object(
        'resource_exists',true,
        'queue_member',exists(
          select 1 from public.hq_workforce_canary_queue_memberships m
          where m.work_item_id=wi.id and m.queue_key='worker_engine_internal'
        ),
        'priority',wi.priority,
        'execution_intent_id',i.id::text,
        'authority_grant_id',i.authority_grant_id::text,
        'plan_step_id',i.plan_step_id::text
      );
    end if;
    v_pass:=v_expected=v_observed;
  elsif t.resource_type='hq_work_items' and t.operation='update' then
    select * into wi from public.hq_work_items where id=v_work_item_id;
    if not found then
      v_expected:=jsonb_build_object('resource_exists',true,'desired_state',i.desired_state,'task_id',t.id,'intent_id',i.id);
      v_observed:=jsonb_build_object('resource_exists',false);
      v_pass:=false;
    else
      v_expected:=jsonb_build_object(
        'resource_exists',true,
        'status',i.desired_state->>'status',
        'task_id',t.id::text,
        'authority_grant_id',i.authority_grant_id::text,
        'plan_step_id',i.plan_step_id::text,
        'execution_intent_id',i.id::text
      );
      v_observed:=jsonb_build_object(
        'resource_exists',true,
        'status',wi.status,
        'task_id',wi.action_taken->>'task_id',
        'authority_grant_id',wi.action_taken->>'authority_grant_id',
        'plan_step_id',wi.action_taken->>'plan_step_id',
        'execution_intent_id',wi.action_taken->>'execution_intent_id'
      );
      v_pass:=v_expected=v_observed;
    end if;
  else
    raise exception 'unsupported_consequential_verification_contract';
  end if;

  -- Negative evidence is deliberately persisted; do not raise on v_pass=false.
  insert into public.hq_workforce_execution_verifications(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    verifier_key,expected_outcome,observed_outcome,verification_contract,passed
  ) values(
    i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    btrim(p_verifier_key),v_expected,v_observed,g.verification_contract,v_pass
  ) returning id into v_id;

  update public.hq_workforce_execution_intents
     set verification_status=case when v_pass then 'passed' else 'failed' end,
         verified_at=clock_timestamp()
   where id=i.id;
  update public.hq_workforce_task_contracts
     set verification_status=case when v_pass then 'verified' else 'failed' end
   where id=t.id;

  return v_id;
end $$;

revoke all on function public.hq_workforce_verify_consequential_execution(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_consequential_execution(uuid,text) to service_role;

-- Canonical verification engineering remains fail-closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.10 canonical verifier fix requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.10 canonical verifier fix changed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.10 canonical verifier fix activated authority'; end if;
end $$;
