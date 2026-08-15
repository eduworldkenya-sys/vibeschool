-- WE-R1.4.1: capability-scoped autonomous authority envelope.
-- NON-ACTIVATING: this migration creates no active authority grant and does not enable runtime execution,
-- heartbeat, Factory, Shadow scheduler, autonomy, or any production mutation capability.
-- access: service-only public.hq_workforce_capability_authority_grants
-- authorization-test: public.hq_workforce_capability_authority_grants denies public/anon/authenticated direct access and service_role is read-only.

create table if not exists public.hq_workforce_capability_authority_grants (
  id uuid primary key default gen_random_uuid(),
  grant_key text not null unique check (char_length(btrim(grant_key)) between 3 and 240),
  capability_key text not null check (char_length(btrim(capability_key)) between 3 and 240),
  capability_version integer not null check (capability_version > 0),
  skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete restrict,
  tool_contract_id uuid not null references public.hq_workforce_tool_contracts(id) on delete restrict,
  permitted_worker_key text references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  operation text not null check (char_length(btrim(operation)) between 1 and 200),
  resource_type text not null check (char_length(btrim(resource_type)) between 1 and 200),
  scope_type text not null default 'platform_internal' check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_ref)='object'),
  autonomy_level smallint not null check (autonomy_level between 1 and 4),
  risk_class smallint not null check (risk_class between 0 and 5),
  max_operations_per_cycle integer not null default 1 check (max_operations_per_cycle between 1 and 1000),
  max_records_per_operation integer not null default 1 check (max_records_per_operation between 1 and 100000),
  max_concurrency integer not null default 1 check (max_concurrency between 1 and 1000),
  max_executions_per_minute integer not null default 1 check (max_executions_per_minute between 1 and 100000),
  idempotency_required boolean not null default true,
  verification_required boolean not null default true,
  compensation_required boolean not null default true,
  compensation_strategy text not null check (char_length(btrim(compensation_strategy)) between 3 and 2000),
  precondition_contract jsonb not null default '[]'::jsonb check (jsonb_typeof(precondition_contract)='array'),
  verification_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(verification_contract)='object'),
  governance_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(governance_evidence)='object'),
  status text not null default 'draft' check (status in ('draft','certified','active','suspended','revoked','expired')),
  issued_at timestamptz not null default clock_timestamp(),
  certified_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default clock_timestamp(),
  check (expires_at > issued_at),
  check ((status not in ('certified','active')) or certified_at is not null),
  check ((status <> 'active') or activated_at is not null),
  check ((status <> 'revoked') or (revoked_at is not null and nullif(btrim(revocation_reason),'') is not null)),
  check ((status <> 'active') or governance_evidence <> '{}'::jsonb),
  unique(capability_key, capability_version, permitted_worker_key, operation, resource_type, scope_type, scope_ref, issued_at)
);

create index if not exists hq_workforce_capability_authority_lookup_idx
  on public.hq_workforce_capability_authority_grants(capability_key,capability_version,status,expires_at);
create index if not exists hq_workforce_capability_authority_worker_idx
  on public.hq_workforce_capability_authority_grants(permitted_worker_key,status,expires_at)
  where permitted_worker_key is not null;

create or replace function public.hq_workforce_issue_capability_authority_draft(
  p_grant_key text,
  p_capability_key text,
  p_capability_version integer,
  p_skill_manifest_id uuid,
  p_tool_contract_id uuid,
  p_permitted_worker_key text,
  p_operation text,
  p_resource_type text,
  p_scope_type text,
  p_scope_ref jsonb,
  p_autonomy_level smallint,
  p_risk_class smallint,
  p_max_operations_per_cycle integer,
  p_max_records_per_operation integer,
  p_max_concurrency integer,
  p_max_executions_per_minute integer,
  p_idempotency_required boolean,
  p_verification_required boolean,
  p_compensation_required boolean,
  p_compensation_strategy text,
  p_precondition_contract jsonb,
  p_verification_contract jsonb,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid;
  v_skill public.hq_workforce_skill_manifests%rowtype;
  v_tool public.hq_workforce_tool_contracts%rowtype;
begin
  if char_length(btrim(coalesce(p_grant_key,''))) not between 3 and 240 then raise exception 'capability_authority_grant_key_invalid'; end if;
  if char_length(btrim(coalesce(p_capability_key,''))) not between 3 and 240 then raise exception 'capability_authority_capability_key_invalid'; end if;
  if p_capability_version is null or p_capability_version <= 0 then raise exception 'capability_authority_version_invalid'; end if;
  if coalesce(jsonb_typeof(p_scope_ref),'null') <> 'object' then raise exception 'capability_authority_scope_ref_invalid'; end if;
  if coalesce(jsonb_typeof(p_precondition_contract),'null') <> 'array' then raise exception 'capability_authority_preconditions_invalid'; end if;
  if coalesce(jsonb_typeof(p_verification_contract),'null') <> 'object' then raise exception 'capability_authority_verification_invalid'; end if;
  if p_expires_at is null or p_expires_at <= clock_timestamp() then raise exception 'capability_authority_expiry_invalid'; end if;
  if p_autonomy_level not between 1 and 4 then raise exception 'capability_authority_autonomy_invalid'; end if;
  if p_risk_class not between 0 and 5 then raise exception 'capability_authority_risk_invalid'; end if;
  if p_max_operations_per_cycle not between 1 and 1000 then raise exception 'capability_authority_cycle_limit_invalid'; end if;
  if p_max_records_per_operation not between 1 and 100000 then raise exception 'capability_authority_record_limit_invalid'; end if;
  if p_max_concurrency not between 1 and 1000 then raise exception 'capability_authority_concurrency_invalid'; end if;
  if p_max_executions_per_minute not between 1 and 100000 then raise exception 'capability_authority_rate_invalid'; end if;
  if p_compensation_required and char_length(btrim(coalesce(p_compensation_strategy,''))) < 3 then raise exception 'capability_authority_compensation_required'; end if;

  select * into v_skill from public.hq_workforce_skill_manifests where id=p_skill_manifest_id;
  if not found then raise exception 'capability_authority_skill_manifest_not_found'; end if;
  select * into v_tool from public.hq_workforce_tool_contracts where id=p_tool_contract_id;
  if not found then raise exception 'capability_authority_tool_contract_not_found'; end if;
  if v_skill.tool_contract_id is distinct from v_tool.id then raise exception 'capability_authority_skill_tool_mismatch'; end if;
  if v_tool.required_capability_key is distinct from p_capability_key then raise exception 'capability_authority_tool_capability_mismatch'; end if;
  if v_tool.operation is distinct from p_operation or v_tool.resource_type is distinct from p_resource_type then raise exception 'capability_authority_tool_operation_mismatch'; end if;
  if v_skill.autonomy_required > p_autonomy_level then raise exception 'capability_authority_below_skill_autonomy_requirement'; end if;
  if v_skill.risk_class > p_risk_class then raise exception 'capability_authority_below_skill_risk_requirement'; end if;
  if p_permitted_worker_key is not null and not exists(select 1 from public.hq_workforce_workers where worker_key=p_permitted_worker_key) then raise exception 'capability_authority_worker_not_found'; end if;

  insert into public.hq_workforce_capability_authority_grants(
    grant_key,capability_key,capability_version,skill_manifest_id,tool_contract_id,permitted_worker_key,
    operation,resource_type,scope_type,scope_ref,autonomy_level,risk_class,max_operations_per_cycle,
    max_records_per_operation,max_concurrency,max_executions_per_minute,idempotency_required,
    verification_required,compensation_required,compensation_strategy,precondition_contract,
    verification_contract,status,expires_at
  ) values(
    btrim(p_grant_key),btrim(p_capability_key),p_capability_version,p_skill_manifest_id,p_tool_contract_id,p_permitted_worker_key,
    btrim(p_operation),btrim(p_resource_type),coalesce(nullif(btrim(p_scope_type),''),'platform_internal'),p_scope_ref,p_autonomy_level,p_risk_class,
    p_max_operations_per_cycle,p_max_records_per_operation,p_max_concurrency,p_max_executions_per_minute,
    coalesce(p_idempotency_required,true),coalesce(p_verification_required,true),coalesce(p_compensation_required,true),
    btrim(p_compensation_strategy),p_precondition_contract,p_verification_contract,'draft',p_expires_at
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_resolve_active_capability_authority(
  p_worker_key text,
  p_capability_key text,
  p_capability_version integer,
  p_skill_manifest_id uuid,
  p_tool_contract_id uuid,
  p_operation text,
  p_resource_type text,
  p_scope_type text,
  p_scope_ref jsonb,
  p_required_autonomy smallint,
  p_risk_class smallint
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid;
begin
  if coalesce(jsonb_typeof(p_scope_ref),'null') <> 'object' then raise exception 'capability_authority_scope_ref_invalid'; end if;
  select g.id into v_id
  from public.hq_workforce_capability_authority_grants g
  where g.status='active'
    and g.expires_at>clock_timestamp()
    and g.capability_key=p_capability_key
    and g.capability_version=p_capability_version
    and g.skill_manifest_id=p_skill_manifest_id
    and g.tool_contract_id=p_tool_contract_id
    and (g.permitted_worker_key is null or g.permitted_worker_key=p_worker_key)
    and g.operation=p_operation
    and g.resource_type=p_resource_type
    and g.scope_type=p_scope_type
    and g.scope_ref=p_scope_ref
    and p_required_autonomy<=g.autonomy_level
    and p_risk_class<=g.risk_class
  order by g.activated_at desc nulls last, g.issued_at desc
  limit 1;
  if v_id is null then raise exception 'capability_autonomous_authority_denied'; end if;
  return v_id;
end $$;

alter table public.hq_workforce_capability_authority_grants enable row level security;
revoke all on table public.hq_workforce_capability_authority_grants from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_capability_authority_grants to service_role;

revoke all on function public.hq_workforce_issue_capability_authority_draft(text,text,integer,uuid,uuid,text,text,text,text,jsonb,smallint,smallint,integer,integer,integer,integer,boolean,boolean,boolean,text,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.hq_workforce_issue_capability_authority_draft(text,text,integer,uuid,uuid,text,text,text,text,jsonb,smallint,smallint,integer,integer,integer,integer,boolean,boolean,boolean,text,jsonb,jsonb,timestamptz) to service_role;
revoke all on function public.hq_workforce_resolve_active_capability_authority(text,text,integer,uuid,uuid,text,text,text,jsonb,smallint,smallint) from public,anon,authenticated;
grant execute on function public.hq_workforce_resolve_active_capability_authority(text,text,integer,uuid,uuid,text,text,text,jsonb,smallint,smallint) to service_role;

-- Gate invariant: R1.4.1 may define authority but cannot activate any authority or runtime.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.1 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.4.1 violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.1 cannot introduce active capability authority'; end if;
end $$;
