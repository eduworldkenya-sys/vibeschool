-- Autopilot commissioning: forward-only repair for the canonical bounded priority canary.
-- Production contains the hardened R1.4 priority gateway, queue admission boundary and
-- commissioning allowlist, but drift inspection found the capability/tool/skill catalog
-- rows absent. Do not replay the historical migration because its old handler CHECK would
-- narrow away later Content Factory handlers. This migration restores only missing catalog
-- contracts and remains NON-ACTIVATING.

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values (
  'internal.work_queue.prioritize',1,'Internal work queue prioritization',
  'Change only priority for one explicitly admitted internal Worker Engine queue item.',
  jsonb_build_object(
    'resource_type','hq_work_items','queue_key','worker_engine_internal','max_records',1,
    'required_payload',jsonb_build_array('work_item_id','precondition_snapshot','desired_state'),
    'allowed_priorities',jsonb_build_array('low','normal','high','critical')),
  jsonb_build_object('mutation','priority_only','max_records',1),
  jsonb_build_object('independent_verifier',true,'exact_priority_match',true,'max_records',1),
  1,1,'certified',
  jsonb_build_object(
    'mission','Autopilot production commissioning',
    'source_contract','WE-R1.4.9',
    'repair','forward_only_catalog_reconciliation',
    'certification','non-activating',
    'canonical_canary','internal.work_queue.prioritize@1')
)
on conflict(capability_key,version) do update set
  display_name=excluded.display_name,
  purpose=excluded.purpose,
  input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,
  verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,
  autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status='certified',
  provenance=excluded.provenance,
  updated_at=clock_timestamp();

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at
) values (
  'internal.work_queue.prioritize',1,'Prioritize one internal Worker Engine queue item',
  'work_item.prioritize','internal.work_queue.prioritize','update_priority','hq_work_items',
  'internal_write','approved',clock_timestamp()
)
on conflict(tool_key,version) do update set
  title=excluded.title,
  handler_key=excluded.handler_key,
  required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,
  resource_type=excluded.resource_type,
  side_effect_class=excluded.side_effect_class,
  status='approved',
  approved_at=coalesce(public.hq_workforce_tool_contracts.approved_at,clock_timestamp());

insert into public.hq_workforce_skill_manifests(
  skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,
  allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,
  requires_human_approval,verification_required,compensation_strategy,owner_key,
  certification_status,certified_at
)
select
  'internal.work_queue.prioritize',1,tc.id,1,1,array['platform_internal']::text[],
  array['internal']::text[],1,1,5000,false,true,
  'restore_exact_pre_execution_priority_if_expected_state_still_matches',
  'platform_governance','certified',clock_timestamp()
from public.hq_workforce_tool_contracts tc
where tc.tool_key='internal.work_queue.prioritize' and tc.version=1
on conflict(tool_contract_id) do update set
  skill_key='internal.work_queue.prioritize',
  version=1,
  autonomy_required=1,
  risk_class=1,
  allowed_scope_types=array['platform_internal']::text[],
  allowed_data_classes=array['internal']::text[],
  max_records_affected=1,
  max_attempts=1,
  max_runtime_ms=5000,
  requires_human_approval=false,
  verification_required=true,
  compensation_strategy='restore_exact_pre_execution_priority_if_expected_state_still_matches',
  owner_key='platform_governance',
  certification_status='certified',
  certified_at=coalesce(public.hq_workforce_skill_manifests.certified_at,clock_timestamp());

insert into public.hq_workforce_skill_capabilities(skill_manifest_id,capability_id,coverage,role,evidence)
select sm.id,c.id,1,'implements',jsonb_build_object(
  'mission','Autopilot production commissioning',
  'source_contract','WE-R1.4.9',
  'contract','priority_only',
  'repair','forward_only_catalog_reconciliation')
from public.hq_workforce_skill_manifests sm
join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
join public.hq_workforce_capabilities c
  on c.capability_key='internal.work_queue.prioritize' and c.version=1
where tc.tool_key='internal.work_queue.prioritize' and tc.version=1
on conflict(skill_manifest_id,capability_id,role) do update set
  coverage=1,evidence=excluded.evidence;

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_handler_check text;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'priority_canary_catalog_repair_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'priority_canary_catalog_repair_changed_fail_closed_posture';
  end if;

  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active') then
    raise exception 'priority_canary_catalog_repair_activated_authority';
  end if;
  if exists(select 1 from public.hq_workforce_canary_queue_memberships) then
    raise exception 'priority_canary_catalog_repair_admitted_live_target';
  end if;

  if not exists(select 1 from public.hq_workforce_capabilities
    where capability_key='internal.work_queue.prioritize' and version=1
      and lifecycle_status='certified' and risk_class=1 and autonomy_ceiling=1) then
    raise exception 'priority_canary_capability_missing_after_repair';
  end if;
  if not exists(select 1 from public.hq_workforce_tool_contracts
    where tool_key='internal.work_queue.prioritize' and version=1 and status='approved'
      and handler_key='work_item.prioritize' and required_capability_key='internal.work_queue.prioritize'
      and operation='update_priority' and resource_type='hq_work_items') then
    raise exception 'priority_canary_tool_missing_after_repair';
  end if;
  if not exists(select 1 from public.hq_workforce_skill_manifests sm
    join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
    where tc.tool_key='internal.work_queue.prioritize' and tc.version=1
      and sm.certification_status='certified' and sm.max_records_affected=1
      and sm.max_attempts=1 and sm.max_runtime_ms=5000
      and sm.verification_required and not sm.requires_human_approval) then
    raise exception 'priority_canary_skill_missing_after_repair';
  end if;

  select pg_get_constraintdef(oid) into v_handler_check
  from pg_constraint
  where conrelid='public.hq_workforce_tool_contracts'::regclass
    and conname='hq_workforce_tool_contracts_handler_key_check';
  if v_handler_check not like '%work_item.prioritize%'
     or v_handler_check not like '%content.research.external%'
     or v_handler_check not like '%content.evidence.semantic_verify%'
     or v_handler_check not like '%content.authoring.source_grounded%' then
    raise exception 'priority_canary_catalog_repair_regressed_handler_contract:%',v_handler_check;
  end if;
end $$;
