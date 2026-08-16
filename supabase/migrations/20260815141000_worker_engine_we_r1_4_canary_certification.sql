-- WE-R1.4.9: certify the bounded internal work-queue priority canary.
-- NON-ACTIVATING. This migration defines/certifies contracts only. It does not create an
-- active authority grant, enable runtime, heartbeat, Factory, Shadow, autonomy or risk.
-- access: service-only public.hq_workforce_canary_queue_memberships
-- authorization-test: public.hq_workforce_canary_queue_memberships denies public/anon/authenticated direct access.

-- A work item is not in the R1.4 canary blast radius merely because it lives in hq_work_items.
-- Membership is explicit so the capability cannot drift into school/product/content work.
create table if not exists public.hq_workforce_canary_queue_memberships (
  work_item_id uuid primary key references public.hq_work_items(id) on delete restrict,
  queue_key text not null default 'worker_engine_internal'
    check (queue_key='worker_engine_internal'),
  admitted_by text not null check (char_length(btrim(admitted_by)) between 3 and 240),
  admission_reason text not null check (char_length(btrim(admission_reason)) between 3 and 1000),
  admitted_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_canary_queue_memberships enable row level security;
revoke all on table public.hq_workforce_canary_queue_memberships from public,anon,authenticated,service_role;
grant select,insert,delete on table public.hq_workforce_canary_queue_memberships to service_role;

-- Widen the structural handler enum by exactly one bounded handler. This does not make it
-- executable: the canonical gateway, runtime policy, capability grant and R1.4 authority
-- envelope remain independently mandatory.
alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check
  check (handler_key in ('work_item.triage_and_own','work_item.prioritize'));

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
  jsonb_build_object('mission','WE-R1.4.9','certification','non-activating','canonical_canary','internal.work_queue.prioritize@1')
)
on conflict(capability_key,version) do update set
  display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status='certified',provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at
) values (
  'internal.work_queue.prioritize',1,'Prioritize one internal Worker Engine queue item',
  'work_item.prioritize','internal.work_queue.prioritize','update_priority','hq_work_items',
  'internal_write','approved',clock_timestamp()
)
on conflict(tool_key,version) do update set
  title=excluded.title,handler_key=excluded.handler_key,
  required_capability_key=excluded.required_capability_key,operation=excluded.operation,
  resource_type=excluded.resource_type,side_effect_class=excluded.side_effect_class,
  status='approved',approved_at=coalesce(public.hq_workforce_tool_contracts.approved_at,clock_timestamp());

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
  autonomy_required=excluded.autonomy_required,risk_class=excluded.risk_class,
  allowed_scope_types=excluded.allowed_scope_types,allowed_data_classes=excluded.allowed_data_classes,
  max_records_affected=1,max_attempts=1,max_runtime_ms=5000,
  requires_human_approval=false,verification_required=true,
  compensation_strategy=excluded.compensation_strategy,owner_key='platform_governance',
  certification_status='certified',certified_at=coalesce(public.hq_workforce_skill_manifests.certified_at,clock_timestamp());

insert into public.hq_workforce_skill_capabilities(skill_manifest_id,capability_id,coverage,role,evidence)
select sm.id,c.id,1,'implements',jsonb_build_object('mission','WE-R1.4.9','contract','priority_only')
from public.hq_workforce_skill_manifests sm
join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
join public.hq_workforce_capabilities c on c.capability_key='internal.work_queue.prioritize' and c.version=1
where tc.tool_key='internal.work_queue.prioritize' and tc.version=1
on conflict(skill_manifest_id,capability_id,role) do update set coverage=1,evidence=excluded.evidence;

-- Certification invariant: exact contracts exist, but certification cannot activate them.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
  v_cap uuid;
  v_tool uuid;
  v_skill uuid;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.9 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.9 violated fail-closed runtime boundary';
  end if;

  select id into v_cap from public.hq_workforce_capabilities
   where capability_key='internal.work_queue.prioritize' and version=1 and lifecycle_status='certified';
  if v_cap is null then raise exception 'WE-R1.4.9 capability certification missing'; end if;
  select id into v_tool from public.hq_workforce_tool_contracts
   where tool_key='internal.work_queue.prioritize' and version=1
     and handler_key='work_item.prioritize' and operation='update_priority'
     and resource_type='hq_work_items' and status='approved';
  if v_tool is null then raise exception 'WE-R1.4.9 tool contract missing'; end if;
  select id into v_skill from public.hq_workforce_skill_manifests
   where tool_contract_id=v_tool and certification_status='certified'
     and max_records_affected=1 and max_attempts=1 and verification_required
     and compensation_strategy='restore_exact_pre_execution_priority_if_expected_state_still_matches';
  if v_skill is null then raise exception 'WE-R1.4.9 skill contract missing'; end if;
  if not exists(select 1 from public.hq_workforce_skill_capabilities
    where skill_manifest_id=v_skill and capability_id=v_cap and role='implements') then
    raise exception 'WE-R1.4.9 skill capability binding missing';
  end if;

  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.9 cannot activate capability authority'; end if;
  if exists(select 1 from public.hq_workforce_canary_queue_memberships) then
    raise exception 'WE-R1.4.9 certification cannot admit production canary queue items';
  end if;
end $$;
