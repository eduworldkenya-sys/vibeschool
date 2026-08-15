-- WE-R1.4.5 hardening: exact post-state capture + ABA-safe compensation collision detection.
-- NON-ACTIVATING. This migration cannot enable runtime, heartbeat, Factory, Shadow or authority.
-- access: service-only helper/compensation functions; no new table access.
-- authorization-test: helper is trigger-only and compensation remains service_role-only.

create or replace function public.hq_workforce_capture_execution_authoritative_after_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intent_id uuid;
begin
  begin
    v_intent_id:=nullif(new.action_taken->>'execution_intent_id','')::uuid;
  exception when invalid_text_representation then
    return new;
  end;
  if v_intent_id is null then return new; end if;

  update public.hq_workforce_execution_intents
     set expected_after_state=jsonb_build_object(
       'status',new.status,
       'action_taken',coalesce(new.action_taken,'null'::jsonb),
       'acted_at',case when new.acted_at is null then null else to_jsonb(new.acted_at) end,
       'updated_at',case when new.updated_at is null then null else to_jsonb(new.updated_at) end
     )
   where id=v_intent_id
     and status='reserved'
     and resource_type='hq_work_items'
     and resource_identity->>'work_item_id'=new.id::text;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_capture_execution_authoritative_after_state on public.hq_work_items;
create trigger trg_hq_workforce_capture_execution_authoritative_after_state
after update on public.hq_work_items
for each row execute function public.hq_workforce_capture_execution_authoritative_after_state();

create or replace function public.hq_workforce_compensate_consequential_execution(
  p_task_id uuid,
  p_requested_by text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  v_work_item_id uuid;
  v_observed jsonb;
  v_comp_id uuid;
  v_before_action jsonb;
  v_before_acted_at timestamptz;
begin
  if char_length(btrim(coalesce(p_requested_by,'')))<3 then raise exception 'compensation_requester_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'compensation_reason_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'compensation_task_not_found'; end if;
  if t.verification_status<>'failed' then raise exception 'compensation_requires_failed_verification'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'compensation_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'compensation_execution_intent_not_committed'; end if;
  if i.verification_status<>'failed' then raise exception 'compensation_requires_failed_intent_verification'; end if;
  if i.authoritative_before_state='{}'::jsonb or i.expected_after_state='{}'::jsonb then raise exception 'compensation_recovery_snapshot_missing'; end if;
  if not (i.expected_after_state ? 'status' and i.expected_after_state ? 'action_taken'
          and i.expected_after_state ? 'acted_at' and i.expected_after_state ? 'updated_at') then
    raise exception 'compensation_authoritative_after_state_incomplete';
  end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'compensation_authority_missing'; end if;
  if g.capability_key is distinct from i.capability_key
     or g.capability_version is distinct from i.capability_version
     or g.operation is distinct from i.operation
     or g.resource_type is distinct from i.resource_type
     or g.scope_type is distinct from i.scope_type
     or g.scope_ref is distinct from i.scope_ref
     or i.plan_step_id is distinct from t.plan_step_id
     or i.authority_grant_id is distinct from t.autonomous_authority_grant_id then
    raise exception 'compensation_authority_lineage_mismatch';
  end if;
  if not g.compensation_required then raise exception 'compensation_not_required_by_authority'; end if;
  if char_length(btrim(coalesce(g.compensation_strategy,'')))<3 then raise exception 'compensation_strategy_missing'; end if;

  if t.resource_type<>'hq_work_items' or t.operation<>'update' then raise exception 'unsupported_consequential_compensation_contract'; end if;
  v_work_item_id:=nullif(i.resource_identity->>'work_item_id','')::uuid;
  if v_work_item_id is null then raise exception 'compensation_resource_identity_missing'; end if;

  select * into wi from public.hq_work_items where id=v_work_item_id for update;
  if not found then
    v_observed:=jsonb_build_object('resource_exists',false);
    insert into public.hq_workforce_execution_compensations(
      intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
    ) values(
      i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
      'conflict_escalated',jsonb_build_object('cause','resource_missing','mutation_applied',false)
    ) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;

  v_observed:=jsonb_build_object(
    'status',wi.status,
    'action_taken',coalesce(wi.action_taken,'null'::jsonb),
    'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end,
    'updated_at',case when wi.updated_at is null then null else to_jsonb(wi.updated_at) end
  );

  -- Exact compare-and-compensate, including resource version, prevents human/process overwrite
  -- and ABA restoration after a stale failed verification.
  if v_observed is distinct from i.expected_after_state then
    insert into public.hq_workforce_execution_compensations(
      intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
    ) values(
      i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
      'conflict_escalated',jsonb_build_object('cause','current_state_diverged','mutation_applied',false,'aba_safe',true)
    ) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;

  v_before_action:=case
    when i.authoritative_before_state->'action_taken'='null'::jsonb then null
    else i.authoritative_before_state->'action_taken'
  end;
  v_before_acted_at:=nullif(i.authoritative_before_state->>'acted_at','')::timestamptz;

  update public.hq_work_items
     set status=i.authoritative_before_state->>'status',
         action_taken=v_before_action,
         acted_at=v_before_acted_at,
         updated_at=clock_timestamp()
   where id=v_work_item_id;

  update public.hq_workforce_execution_intents
     set status='compensated',compensated_at=clock_timestamp()
   where id=i.id and status='committed';
  if not found then raise exception 'compensation_intent_transition_failed'; end if;

  insert into public.hq_workforce_execution_compensations(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
  ) values(
    i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
    'compensated',jsonb_build_object('mutation_applied',true,'resource_type',t.resource_type,
      'resource_identity',i.resource_identity,'exact_state_match',true)
  ) returning id into v_comp_id;

  return jsonb_build_object('compensation_id',v_comp_id,'outcome','compensated','mutation_applied',true);
end $$;

revoke all on function public.hq_workforce_capture_execution_authoritative_after_state() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) to service_role;

-- Hardening must remain non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.5 exact-state hardening requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.5 exact-state hardening violated runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.5 exact-state hardening cannot activate authority'; end if;
end $$;
