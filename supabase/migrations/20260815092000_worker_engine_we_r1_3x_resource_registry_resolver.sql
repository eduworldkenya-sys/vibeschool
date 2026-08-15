-- WE-R1.3X X4: governed Resource Registry + least-sufficient Resource Resolver.
-- NON-ACTIVATING. Existing WE-L5 deterministic-first model gateway and R1.3 resource ceilings remain authoritative safety participants.
-- access: service-only public.hq_workforce_resources
-- authorization-test: public.hq_workforce_resources denies anon/authenticated direct access; service_role manages resource registry only.
-- access: service-only public.hq_workforce_capability_resources
-- authorization-test: public.hq_workforce_capability_resources denies anon/authenticated direct access; service_role manages capability-resource policy only.
-- access: service-only public.hq_workforce_resource_resolution_events
-- authorization-test: public.hq_workforce_resource_resolution_events denies anon/authenticated direct access; service_role appends resolver evidence only.

create table if not exists public.hq_workforce_resources (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null,
  version integer not null default 1 check (version > 0),
  resource_kind text not null check (resource_kind in ('deterministic','internal_api','tool','model','data_source','document','compute','queue','service','human_reviewer','worker','certified_skill')),
  display_name text not null,
  provider_key text,
  enabled boolean not null default false,
  shadow_capable boolean not null default true,
  health_status text not null default 'unknown' check (health_status in ('healthy','degraded','unknown','unavailable','revoked')),
  reliability numeric(5,4) check (reliability is null or reliability between 0 and 1),
  cost_per_unit numeric not null default 0 check (cost_per_unit >= 0),
  cost_unit text not null default 'count',
  latency_class smallint not null default 0 check (latency_class between 0 and 5),
  required_autonomy smallint not null default 0 check (required_autonomy between 0 and 4),
  risk_class smallint not null default 0 check (risk_class between 0 and 5),
  allowed_scope_types text[] not null default array['platform_internal']::text[],
  jurisdictions text[] not null default array['global']::text[],
  allowed_data_classifications text[] not null default array['internal']::text[],
  quota_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(quota_contract)='object'),
  interface_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(interface_contract)='object'),
  provenance jsonb not null check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(resource_key,version),
  check (valid_until is null or valid_until > valid_from)
);
create index if not exists hq_workforce_resources_resolver_idx
  on public.hq_workforce_resources(resource_kind,enabled,shadow_capable,health_status,required_autonomy,risk_class,cost_per_unit,reliability desc nulls last);

create table if not exists public.hq_workforce_capability_resources (
  capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
  resource_id uuid not null references public.hq_workforce_resources(id) on delete restrict,
  access_mode text not null check (access_mode in ('read','reason','invoke','write_control','review')),
  required boolean not null default true,
  minimum_reliability numeric(5,4) not null default 0 check (minimum_reliability between 0 and 1),
  priority integer not null default 100 check (priority >= 0),
  constraints jsonb not null default '{}'::jsonb check (jsonb_typeof(constraints)='object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key(capability_id,resource_id,access_mode)
);
create index if not exists hq_workforce_capability_resources_cap_idx
  on public.hq_workforce_capability_resources(capability_id,required,priority desc);

create table if not exists public.hq_workforce_resource_resolution_events (
  id bigint generated always as identity primary key,
  objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
  selected_resource_id uuid references public.hq_workforce_resources(id) on delete restrict,
  resolution_status text not null check (resolution_status in ('selected','no_eligible_resource','ambiguous','denied')),
  request_contract jsonb not null check (jsonb_typeof(request_contract)='object'),
  considered jsonb not null default '[]'::jsonb check (jsonb_typeof(considered)='array'),
  rationale jsonb not null default '{}'::jsonb check (jsonb_typeof(rationale)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_resource_resolution_events_obj_idx
  on public.hq_workforce_resource_resolution_events(objective_id,created_at desc);

create or replace function public.hq_workforce_resource_resolution_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'worker_engine_resource_resolution_evidence_is_append_only';
end $$;
drop trigger if exists trg_hq_workforce_resource_resolution_events_immutable on public.hq_workforce_resource_resolution_events;
create trigger trg_hq_workforce_resource_resolution_events_immutable
before update or delete on public.hq_workforce_resource_resolution_events
for each row execute function public.hq_workforce_resource_resolution_events_immutable();

create or replace function public.hq_workforce_resolve_resource(
  p_capability_id uuid,
  p_scope_type text,
  p_jurisdiction text default 'global',
  p_data_classification text default 'internal',
  p_access_mode text default 'read',
  p_max_autonomy smallint default 0,
  p_max_risk smallint default 0,
  p_shadow_only boolean default true,
  p_objective_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_selected uuid;
  v_considered jsonb;
  v_status text;
  v_rationale jsonb;
  v_request jsonb;
begin
  if not exists(select 1 from public.hq_workforce_capabilities where id=p_capability_id and lifecycle_status in ('tested','certified')) then raise exception 'capability_not_resolvable'; end if;
  if p_access_mode not in ('read','reason','invoke','write_control','review') then raise exception 'resource_access_mode_invalid'; end if;
  if p_max_autonomy not between 0 and 4 then raise exception 'resource_max_autonomy_invalid'; end if;
  if p_max_risk not between 0 and 5 then raise exception 'resource_max_risk_invalid'; end if;
  if p_objective_id is not null and not exists(select 1 from public.hq_workforce_objectives where id=p_objective_id) then raise exception 'objective_not_found'; end if;

  v_request:=jsonb_build_object('scope_type',p_scope_type,'jurisdiction',p_jurisdiction,'data_classification',p_data_classification,'access_mode',p_access_mode,'max_autonomy',p_max_autonomy,'max_risk',p_max_risk,'shadow_only',p_shadow_only);

  with candidates as (
    select r.*,cr.required,cr.minimum_reliability,cr.priority,
      case
        when not r.enabled then 'disabled'
        when r.health_status in ('unavailable','revoked','unknown') then 'unhealthy'
        when p_shadow_only and not r.shadow_capable then 'not_shadow_capable'
        when r.required_autonomy>p_max_autonomy then 'autonomy_exceeds_ceiling'
        when r.risk_class>p_max_risk then 'risk_exceeds_ceiling'
        when not (p_scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types)) then 'scope_denied'
        when not (p_jurisdiction=any(r.jurisdictions) or 'global'=any(r.jurisdictions)) then 'jurisdiction_denied'
        when not (p_data_classification=any(r.allowed_data_classifications)) then 'classification_denied'
        when coalesce(r.reliability,0)<cr.minimum_reliability then 'reliability_below_minimum'
        else 'eligible' end as eligibility
    from public.hq_workforce_capability_resources cr
    join public.hq_workforce_resources r on r.id=cr.resource_id
    where cr.capability_id=p_capability_id and cr.access_mode=p_access_mode
      and (r.valid_until is null or r.valid_until>clock_timestamp())
  ), ranked as (
    select * from candidates where eligibility='eligible'
    order by required desc,required_autonomy asc,risk_class asc,cost_per_unit asc,latency_class asc,reliability desc nulls last,priority desc,resource_key,version desc
  )
  select id into v_selected from ranked limit 1;

  with candidates as (
    select r.id,r.resource_key,r.version,r.resource_kind,r.required_autonomy,r.risk_class,r.cost_per_unit,r.cost_unit,r.latency_class,r.reliability,cr.required,cr.minimum_reliability,cr.priority,
      case
        when not r.enabled then 'disabled'
        when r.health_status in ('unavailable','revoked','unknown') then 'unhealthy'
        when p_shadow_only and not r.shadow_capable then 'not_shadow_capable'
        when r.required_autonomy>p_max_autonomy then 'autonomy_exceeds_ceiling'
        when r.risk_class>p_max_risk then 'risk_exceeds_ceiling'
        when not (p_scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types)) then 'scope_denied'
        when not (p_jurisdiction=any(r.jurisdictions) or 'global'=any(r.jurisdictions)) then 'jurisdiction_denied'
        when not (p_data_classification=any(r.allowed_data_classifications)) then 'classification_denied'
        when coalesce(r.reliability,0)<cr.minimum_reliability then 'reliability_below_minimum'
        else 'eligible' end as eligibility
    from public.hq_workforce_capability_resources cr join public.hq_workforce_resources r on r.id=cr.resource_id
    where cr.capability_id=p_capability_id and cr.access_mode=p_access_mode and (r.valid_until is null or r.valid_until>clock_timestamp())
  )
  select coalesce(jsonb_agg(jsonb_build_object('resource_id',id,'resource_key',resource_key,'version',version,'kind',resource_kind,'eligibility',eligibility,'autonomy',required_autonomy,'risk',risk_class,'cost',cost_per_unit,'cost_unit',cost_unit,'latency_class',latency_class,'reliability',reliability,'required',required,'minimum_reliability',minimum_reliability,'priority',priority) order by resource_key,version),'[]'::jsonb)
  into v_considered from candidates;

  if v_selected is null then
    v_status:='no_eligible_resource';
    v_rationale:=jsonb_build_object('reason','all_registered_resources_failed_governance_or_health_constraints');
  else
    v_status:='selected';
    v_rationale:=jsonb_build_object('reason','least_sufficient_eligible_resource','ordering',jsonb_build_array('required','least_autonomy','least_risk','least_cost','least_latency','highest_reliability','policy_priority'));
  end if;

  insert into public.hq_workforce_resource_resolution_events(objective_id,capability_id,selected_resource_id,resolution_status,request_contract,considered,rationale)
  values(p_objective_id,p_capability_id,v_selected,v_status,v_request,v_considered,v_rationale);

  return jsonb_build_object('status',v_status,'capability_id',p_capability_id,'selected_resource_id',v_selected,'request',v_request,'considered',v_considered,'rationale',v_rationale,'consequential_execution',false);
end $$;

-- WE-L5 participates as a resource rather than being bypassed. This helper only registers metadata; it never performs a model call.
create or replace function public.hq_workforce_register_model_gateway_resource(
  p_resource_key text,p_display_name text,p_provider_key text,p_model_key text,p_reliability numeric,p_cost_per_unit numeric,p_cost_unit text default 'token'
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_version integer;
begin
  if char_length(btrim(coalesce(p_resource_key,'')))<3 then raise exception 'resource_key_invalid'; end if;
  if p_reliability is null or p_reliability<0 or p_reliability>1 then raise exception 'resource_reliability_invalid'; end if;
  if p_cost_per_unit<0 then raise exception 'resource_cost_invalid'; end if;
  select coalesce(max(version),0)+1 into v_version from public.hq_workforce_resources where resource_key=btrim(p_resource_key);
  insert into public.hq_workforce_resources(resource_key,version,resource_kind,display_name,provider_key,enabled,shadow_capable,health_status,reliability,cost_per_unit,cost_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,interface_contract,provenance)
  values(btrim(p_resource_key),v_version,'model',p_display_name,p_provider_key,false,true,'unknown',p_reliability,p_cost_per_unit,p_cost_unit,0,0,array['platform_internal'],array['global'],array['internal'],jsonb_build_object('gateway','hq_workforce_authorize_model_call','model_key',p_model_key,'deterministic_first',true),jsonb_build_object('source','WE-L5','registered_by','WE-R1.3X-X4')) returning id into v_id;
  return v_id;
end $$;

alter table public.hq_workforce_resources enable row level security;
alter table public.hq_workforce_capability_resources enable row level security;
alter table public.hq_workforce_resource_resolution_events enable row level security;
revoke all on table public.hq_workforce_resources from public,anon,authenticated;
revoke all on table public.hq_workforce_capability_resources from public,anon,authenticated;
revoke all on table public.hq_workforce_resource_resolution_events from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_resources to service_role;
grant select,insert,update on table public.hq_workforce_capability_resources to service_role;
grant select,insert on table public.hq_workforce_resource_resolution_events to service_role;
grant usage,select on sequence public.hq_workforce_resource_resolution_events_id_seq to service_role;
revoke all on function public.hq_workforce_resource_resolution_events_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_resolve_resource(uuid,text,text,text,text,smallint,smallint,boolean,uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_register_model_gateway_resource(text,text,text,text,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_resolve_resource(uuid,text,text,text,text,smallint,smallint,boolean,uuid) to service_role;
grant execute on function public.hq_workforce_register_model_gateway_resource(text,text,text,text,numeric,numeric,text) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
    or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.3X X4 violated fail-closed runtime boundary'; end if;
end $$;
