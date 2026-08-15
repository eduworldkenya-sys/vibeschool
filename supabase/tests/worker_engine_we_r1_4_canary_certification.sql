-- WE-R1.4.9 canary certification acceptance.
begin;

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  c public.hq_workforce_capabilities%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'R1.4.9 acceptance: runtime must remain OFF';
  end if;

  select * into c from public.hq_workforce_capabilities
   where capability_key='internal.work_queue.prioritize' and version=1;
  if not found or c.lifecycle_status<>'certified' then
    raise exception 'R1.4.9 acceptance: canary capability not certified';
  end if;
  if c.input_contract->>'resource_type'<>'hq_work_items'
     or c.input_contract->>'queue_key'<>'worker_engine_internal'
     or (c.input_contract->>'max_records')::integer<>1
     or c.output_contract->>'mutation'<>'priority_only' then
    raise exception 'R1.4.9 acceptance: capability blast radius is not exact';
  end if;

  select * into tc from public.hq_workforce_tool_contracts
   where tool_key='internal.work_queue.prioritize' and version=1;
  if not found or tc.status<>'approved' or tc.handler_key<>'work_item.prioritize'
     or tc.required_capability_key<>'internal.work_queue.prioritize'
     or tc.operation<>'update_priority' or tc.resource_type<>'hq_work_items' then
    raise exception 'R1.4.9 acceptance: exact tool contract missing';
  end if;

  select * into sm from public.hq_workforce_skill_manifests where tool_contract_id=tc.id;
  if not found or sm.certification_status<>'certified' or sm.max_records_affected<>1
     or sm.max_attempts<>1 or not sm.verification_required
     or sm.compensation_strategy<>'restore_exact_pre_execution_priority_if_expected_state_still_matches' then
    raise exception 'R1.4.9 acceptance: exact skill/recovery contract missing';
  end if;
  if not exists(select 1 from public.hq_workforce_skill_capabilities
    where skill_manifest_id=sm.id and capability_id=c.id and role='implements') then
    raise exception 'R1.4.9 acceptance: skill/capability binding missing';
  end if;

  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active') then
    raise exception 'R1.4.9 acceptance: certification activated authority';
  end if;
  if exists(select 1 from public.hq_workforce_canary_queue_memberships) then
    raise exception 'R1.4.9 acceptance: certification admitted a live canary target';
  end if;
end $$;

-- Structural privilege checks: ordinary product roles cannot mutate the admission boundary.
do $$
begin
  if has_table_privilege('anon','public.hq_workforce_canary_queue_memberships','INSERT')
     or has_table_privilege('authenticated','public.hq_workforce_canary_queue_memberships','INSERT')
     or has_table_privilege('anon','public.hq_workforce_canary_queue_memberships','DELETE')
     or has_table_privilege('authenticated','public.hq_workforce_canary_queue_memberships','DELETE') then
    raise exception 'R1.4.9 acceptance: product role can alter canary membership';
  end if;
end $$;

rollback;
