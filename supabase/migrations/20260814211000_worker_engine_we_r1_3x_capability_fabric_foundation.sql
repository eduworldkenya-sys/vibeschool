-- WE-R1.3X.1-.3: Global Resource Registry + Competency Graph + Capability Graph.
-- Additive, service-only, Shadow/L0 safe. MUST NOT activate runtime, heartbeat, factory, cron or consequential execution.
-- access: service-only public.hq_workforce_resources
-- access: service-only public.hq_workforce_worker_competencies
-- access: service-only public.hq_workforce_capability_edges

create table if not exists public.hq_workforce_resources (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null,
  version integer not null default 1 check (version > 0),
  resource_type text not null check (resource_type in ('table','view','rpc','function','api','repository','document','dataset','search','model','human','tool','queue','other')),
  display_name text not null,
  description text,
  owner_key text,
  provenance jsonb not null default '{}'::jsonb,
  trust_tier smallint not null default 0 check (trust_tier between 0 and 5),
  freshness_policy jsonb not null default '{}'::jsonb,
  data_classifications text[] not null default array['internal']::text[],
  jurisdictions text[] not null default array['global']::text[],
  allowed_scope_types text[] not null default array['global']::text[],
  allowed_operations text[] not null default array['read']::text[],
  required_autonomy smallint not null default 0 check (required_autonomy between 0 and 4),
  risk_class smallint not null default 0 check (risk_class between 0 and 5),
  cost_profile jsonb not null default '{}'::jsonb,
  quota_policy jsonb not null default '{}'::jsonb,
  latency_profile jsonb not null default '{}'::jsonb,
  health_status text not null default 'unknown' check (health_status in ('healthy','degraded','unavailable','unknown','revoked')),
  enabled boolean not null default false,
  shadow_capable boolean not null default false,
  immutable_version_key text generated always as (resource_key||'@'||version::text) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(resource_key,version),
  unique(immutable_version_key)
);

create index if not exists hq_workforce_resources_discovery_idx
  on public.hq_workforce_resources(resource_type,enabled,shadow_capable,health_status,trust_tier desc);

create table if not exists public.hq_workforce_worker_competencies (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null,
  competency_key text not null,
  version integer not null default 1 check (version > 0),
  proficiency numeric(5,4) not null check (proficiency between 0 and 1),
  reliability numeric(5,4) check (reliability is null or reliability between 0 and 1),
  certification_status text not null default 'draft' check (certification_status in ('draft','tested','certified','revoked')),
  evidence jsonb not null default '{}'::jsonb,
  allowed_scope_types text[] not null default array['global']::text[],
  jurisdictions text[] not null default array['global']::text[],
  capacity_profile jsonb not null default '{}'::jsonb,
  last_evaluated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(worker_key,competency_key,version)
);

create index if not exists hq_workforce_worker_competencies_route_idx
  on public.hq_workforce_worker_competencies(competency_key,certification_status,proficiency desc,reliability desc nulls last);

-- Capability composition reuses the certified skill manifest as the capability node.
-- This edge table turns isolated skills into a directed, typed, auditable graph.
create table if not exists public.hq_workforce_capability_edges (
  id uuid primary key default gen_random_uuid(),
  from_skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete restrict,
  to_skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete restrict,
  relation_type text not null check (relation_type in ('requires','enables','alternative_to','verifies','compensates','consults','hands_off_to')),
  input_mapping jsonb not null default '{}'::jsonb,
  output_mapping jsonb not null default '{}'::jsonb,
  condition_contract jsonb not null default '{}'::jsonb,
  priority integer not null default 100 check (priority >= 0),
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (from_skill_manifest_id <> to_skill_manifest_id),
  unique(from_skill_manifest_id,to_skill_manifest_id,relation_type)
);

create index if not exists hq_workforce_capability_edges_from_idx on public.hq_workforce_capability_edges(from_skill_manifest_id,enabled,priority);
create index if not exists hq_workforce_capability_edges_to_idx on public.hq_workforce_capability_edges(to_skill_manifest_id,enabled,priority);

-- Explicit skill/resource binding. A skill cannot silently discover an unregistered resource.
create table if not exists public.hq_workforce_skill_resources (
  skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete cascade,
  resource_id uuid not null references public.hq_workforce_resources(id) on delete restrict,
  usage_role text not null check (usage_role in ('input','lookup','compute','output','verification','escalation')),
  required boolean not null default true,
  operation text not null default 'read',
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  primary key(skill_manifest_id,resource_id,usage_role)
);

create or replace function public.hq_workforce_discover_shadow_resources(
  p_scope_type text,
  p_jurisdiction text default 'global',
  p_operation text default 'read',
  p_limit integer default 25
) returns table(
  resource_id uuid,
  resource_key text,
  version integer,
  resource_type text,
  trust_tier smallint,
  health_status text,
  fitness_score numeric
)
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  select r.id,r.resource_key,r.version,r.resource_type,r.trust_tier,r.health_status,
         ((r.trust_tier::numeric / 5.0)
           + case when r.health_status='healthy' then 1 else 0 end
           + case when p_scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types) then 1 else 0 end
           + case when p_jurisdiction=any(r.jurisdictions) or 'global'=any(r.jurisdictions) then 1 else 0 end) / 4.0 as fitness_score
    from public.hq_workforce_resources r
   where r.enabled
     and r.shadow_capable
     and r.health_status in ('healthy','degraded')
     and r.required_autonomy=0
     and r.risk_class<=2
     and p_operation=any(r.allowed_operations)
     and (p_scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types))
     and (p_jurisdiction=any(r.jurisdictions) or 'global'=any(r.jurisdictions))
   order by fitness_score desc,r.trust_tier desc,r.resource_key
   limit greatest(1,least(coalesce(p_limit,25),100));
$$;

create or replace function public.hq_workforce_rank_workers_by_competency(
  p_competency_keys text[],
  p_scope_type text,
  p_jurisdiction text default 'global',
  p_limit integer default 10
) returns table(worker_key text,matched_competencies integer,fit_score numeric)
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  select c.worker_key,
         count(distinct c.competency_key)::integer,
         avg((c.proficiency * 0.7) + (coalesce(c.reliability,c.proficiency) * 0.3))::numeric as fit_score
    from public.hq_workforce_worker_competencies c
   where c.competency_key=any(p_competency_keys)
     and c.certification_status='certified'
     and (c.expires_at is null or c.expires_at>clock_timestamp())
     and (p_scope_type=any(c.allowed_scope_types) or 'global'=any(c.allowed_scope_types))
     and (p_jurisdiction=any(c.jurisdictions) or 'global'=any(c.jurisdictions))
   group by c.worker_key
   order by count(distinct c.competency_key) desc,fit_score desc,c.worker_key
   limit greatest(1,least(coalesce(p_limit,10),100));
$$;

alter table public.hq_workforce_resources enable row level security;
alter table public.hq_workforce_worker_competencies enable row level security;
alter table public.hq_workforce_capability_edges enable row level security;
alter table public.hq_workforce_skill_resources enable row level security;

revoke all on table public.hq_workforce_resources from public,anon,authenticated;
revoke all on table public.hq_workforce_worker_competencies from public,anon,authenticated;
revoke all on table public.hq_workforce_capability_edges from public,anon,authenticated;
revoke all on table public.hq_workforce_skill_resources from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_resources to service_role;
grant select,insert,update on table public.hq_workforce_worker_competencies to service_role;
grant select,insert,update on table public.hq_workforce_capability_edges to service_role;
grant select,insert,update on table public.hq_workforce_skill_resources to service_role;

revoke all on function public.hq_workforce_discover_shadow_resources(text,text,text,integer) from public,anon,authenticated;
revoke all on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_discover_shadow_resources(text,text,text,integer) to service_role;
grant execute on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer) to service_role;

-- Migration-level fail-closed assertion. Existing production Shadow Mode may be ON;
-- this migration is forbidden from changing that state or enabling consequential runtime.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
    raise exception 'WE-R1.3X capability fabric violated L0/consequential-runtime boundary';
  end if;
end $$;