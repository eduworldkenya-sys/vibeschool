-- WE-R1.3X X3: Capability + Competency Graphs.
-- NON-ACTIVATING. Capability is explicitly distinct from certified skill/procedure.
-- access: service-only public.hq_workforce_capabilities
-- authorization-test: public.hq_workforce_capabilities denies anon/authenticated direct access; service_role manages capability ontology only.
-- access: service-only public.hq_workforce_capability_edges
-- authorization-test: public.hq_workforce_capability_edges denies anon/authenticated direct access; service_role manages capability composition relationships only.
-- access: service-only public.hq_workforce_skill_capabilities
-- authorization-test: public.hq_workforce_skill_capabilities denies anon/authenticated direct access; service_role binds certified procedures to capabilities.
-- access: service-only public.hq_workforce_worker_competencies
-- authorization-test: public.hq_workforce_worker_competencies denies anon/authenticated direct access; service_role manages measured competency evidence.

create table if not exists public.hq_workforce_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null,
  version integer not null default 1 check (version > 0),
  display_name text not null,
  purpose text not null,
  input_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(input_contract)='object'),
  output_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(output_contract)='object'),
  verification_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(verification_contract)='object'),
  risk_class smallint not null default 0 check (risk_class between 0 and 5),
  autonomy_ceiling smallint not null default 0 check (autonomy_ceiling between 0 and 4),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','tested','certified','deprecated','revoked')),
  provenance jsonb not null check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(capability_key,version)
);
create index if not exists hq_workforce_capabilities_lookup_idx
  on public.hq_workforce_capabilities(capability_key,lifecycle_status,risk_class,autonomy_ceiling,version desc);

create table if not exists public.hq_workforce_capability_edges (
  id uuid primary key default gen_random_uuid(),
  from_capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
  to_capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
  relation_type text not null check (relation_type in ('requires','enables','alternative_to','verifies','compensates','consults','hands_off_to')),
  condition_contract jsonb not null default '{}'::jsonb check (jsonb_typeof(condition_contract)='object'),
  priority integer not null default 100 check (priority >= 0),
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (from_capability_id <> to_capability_id),
  unique(from_capability_id,to_capability_id,relation_type)
);
create index if not exists hq_workforce_capability_edges_from_idx on public.hq_workforce_capability_edges(from_capability_id,enabled,priority);
create index if not exists hq_workforce_capability_edges_to_idx on public.hq_workforce_capability_edges(to_capability_id,enabled,priority);

create table if not exists public.hq_workforce_skill_capabilities (
  skill_manifest_id uuid not null references public.hq_workforce_skill_manifests(id) on delete restrict,
  capability_id uuid not null references public.hq_workforce_capabilities(id) on delete restrict,
  coverage numeric(5,4) not null default 1 check (coverage > 0 and coverage <= 1),
  role text not null default 'implements' check (role in ('implements','supports','verifies','compensates')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key(skill_manifest_id,capability_id,role)
);

create table if not exists public.hq_workforce_worker_competencies (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  competency_key text not null,
  version integer not null default 1 check (version > 0),
  proficiency numeric(5,4) not null check (proficiency between 0 and 1),
  reliability numeric(5,4) check (reliability is null or reliability between 0 and 1),
  sample_count bigint not null default 0 check (sample_count >= 0),
  certification_status text not null default 'draft' check (certification_status in ('draft','tested','certified','revoked')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  scope_types text[] not null default array['global']::text[],
  jurisdictions text[] not null default array['global']::text[],
  last_evaluated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(worker_key,competency_key,version)
);
create index if not exists hq_workforce_worker_competencies_route_idx
  on public.hq_workforce_worker_competencies(competency_key,certification_status,proficiency desc,reliability desc nulls last,sample_count desc);

create or replace function public.hq_workforce_rank_workers_by_competency(
  p_competency_keys text[],
  p_scope_type text,
  p_jurisdiction text default 'global',
  p_limit integer default 10
) returns table(worker_key text,matched_competencies integer,coverage numeric,fit_score numeric)
language sql security definer set search_path=public,pg_temp stable as $$
  with requested as (
    select distinct x as competency_key from unnest(coalesce(p_competency_keys,'{}'::text[])) x
  ), ranked as (
    select c.worker_key,
           count(distinct c.competency_key)::integer as matched,
           count(distinct c.competency_key)::numeric / nullif((select count(*) from requested),0)::numeric as cov,
           avg((c.proficiency*0.65)+(coalesce(c.reliability,c.proficiency)*0.25)+least(c.sample_count,100)::numeric/1000.0) as score
    from public.hq_workforce_worker_competencies c
    join requested r on r.competency_key=c.competency_key
    join public.hq_workforce_workers w on w.worker_key=c.worker_key
    where w.status in ('probation','active','restricted')
      and c.certification_status='certified'
      and (c.expires_at is null or c.expires_at>clock_timestamp())
      and (p_scope_type=any(c.scope_types) or 'global'=any(c.scope_types))
      and (p_jurisdiction=any(c.jurisdictions) or 'global'=any(c.jurisdictions))
    group by c.worker_key
  )
  select worker_key,matched,cov,least(score,1)::numeric
  from ranked
  order by cov desc,score desc,worker_key
  limit greatest(1,least(coalesce(p_limit,10),100));
$$;

create or replace function public.hq_workforce_resolve_capability_skills(
  p_capability_ids uuid[],
  p_shadow_only boolean default true
) returns table(skill_manifest_id uuid,matched_capabilities integer,coverage numeric)
language sql security definer set search_path=public,pg_temp stable as $$
  with requested as (select distinct x as capability_id from unnest(coalesce(p_capability_ids,'{}'::uuid[])) x), ranked as (
    select sc.skill_manifest_id,count(distinct sc.capability_id)::integer matched,
           sum(sc.coverage)::numeric/nullif((select count(*) from requested),0)::numeric coverage
    from public.hq_workforce_skill_capabilities sc
    join requested r on r.capability_id=sc.capability_id
    join public.hq_workforce_skill_manifests m on m.id=sc.skill_manifest_id
    where m.certification_status='certified'
      and (not p_shadow_only or m.shadow_capable)
    group by sc.skill_manifest_id
  )
  select skill_manifest_id,matched,least(coverage,1)::numeric from ranked order by coverage desc,matched desc,skill_manifest_id;
$$;

alter table public.hq_workforce_capabilities enable row level security;
alter table public.hq_workforce_capability_edges enable row level security;
alter table public.hq_workforce_skill_capabilities enable row level security;
alter table public.hq_workforce_worker_competencies enable row level security;

revoke all on table public.hq_workforce_capabilities from public,anon,authenticated;
revoke all on table public.hq_workforce_capability_edges from public,anon,authenticated;
revoke all on table public.hq_workforce_skill_capabilities from public,anon,authenticated;
revoke all on table public.hq_workforce_worker_competencies from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_capabilities to service_role;
grant select,insert,update on table public.hq_workforce_capability_edges to service_role;
grant select,insert,update on table public.hq_workforce_skill_capabilities to service_role;
grant select,insert,update on table public.hq_workforce_worker_competencies to service_role;

revoke all on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer) from public,anon,authenticated;
revoke all on function public.hq_workforce_resolve_capability_skills(uuid[],boolean) from public,anon,authenticated;
grant execute on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer) to service_role;
grant execute on function public.hq_workforce_resolve_capability_skills(uuid[],boolean) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.3X X3 violated fail-closed runtime boundary';
  end if;
end $$;
