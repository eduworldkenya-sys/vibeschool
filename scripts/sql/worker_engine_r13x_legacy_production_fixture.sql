-- Disposable-test fixture for the production-only WE-R1.3X generation
-- (ledger versions 20260815053502..20260815054004).
-- This file is NEVER a production migration.

set search_path=public,pg_temp;

drop table if exists public.hq_workforce_evaluations cascade;
drop table if exists public.hq_workforce_skill_resources cascade;
drop table if exists public.hq_workforce_competency_capabilities cascade;
drop table if exists public.hq_workforce_collaborations cascade;
drop table if exists public.hq_workforce_capability_edges cascade;
drop table if exists public.hq_workforce_resources cascade;
drop table if exists public.hq_workforce_worker_competencies cascade;
drop table if exists public.hq_workforce_architecture_components cascade;
drop table if exists public.hq_workforce_calibration cascade;
drop table if exists public.hq_workforce_skill_candidates cascade;
drop table if exists public.hq_workforce_factory_recommendations cascade;
drop table if exists public.hq_workforce_memory cascade;

create table public.hq_workforce_resources (
 id uuid primary key default gen_random_uuid(), resource_key text not null, version integer not null default 1,
 resource_type text not null, display_name text not null, description text, owner_key text,
 provenance jsonb not null default '{}'::jsonb, trust_tier smallint not null default 0,
 freshness_policy jsonb not null default '{}'::jsonb, data_classifications text[] not null default '{}',
 jurisdictions text[] not null default '{}', allowed_scope_types text[] not null default '{}',
 allowed_operations text[] not null default '{}', required_autonomy smallint not null default 0,
 risk_class smallint not null default 0, cost_profile jsonb not null default '{}'::jsonb,
 quota_policy jsonb not null default '{}'::jsonb, latency_profile jsonb not null default '{}'::jsonb,
 health_status text not null default 'unknown', enabled boolean not null default false,
 shadow_capable boolean not null default true, immutable_version_key text not null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(), unique(resource_key,version),unique(immutable_version_key)
);
insert into public.hq_workforce_resources(resource_key,resource_type,display_name,description,owner_key,provenance,trust_tier,freshness_policy,data_classifications,jurisdictions,allowed_scope_types,allowed_operations,cost_profile,quota_policy,latency_profile,health_status,enabled,shadow_capable,immutable_version_key,metadata)
values
 ('vibeschool.internal.work_items','table','Vibeschool internal work queue','Approved operational facts used for Shadow work detection and planning.','platform_governance','{"relation":"hq_work_items"}',5,'{"mode":"live"}',array['internal'],array['global'],array['platform_internal','global'],array['read'],'{"unit_cost":0}','{"bounded_by_shadow_scheduler":true}','{"class":"local_database"}','healthy',true,true,'vibeschool.internal.work_items@1','{"canonical":true}'),
 ('vibeschool.worker.engine.evidence','table','Worker Engine evidence store','Existing governed trace/evidence facts available for verification and learning.','platform_governance','{"relation":"hq_workforce_evidence"}',5,'{"mode":"live"}',array['internal'],array['global'],array['platform_internal','global'],array['read'],'{"unit_cost":0}','{"read_only_for_planning":true}','{"class":"local_database"}','healthy',true,true,'vibeschool.worker.engine.evidence@1','{"canonical":true}');

create table public.hq_workforce_worker_competencies (
 id uuid primary key default gen_random_uuid(), worker_key text not null, competency_key text not null,
 version integer not null default 1, proficiency numeric(5,4) not null, reliability numeric(5,4),
 certification_status text not null default 'draft', evidence jsonb not null default '{}'::jsonb,
 allowed_scope_types text[] not null default array['global']::text[], jurisdictions text[] not null default array['global']::text[],
 capacity_profile jsonb not null default '{}'::jsonb, last_evaluated_at timestamptz, expires_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(worker_key,competency_key,version)
);
do $$ declare wk text; begin
 select worker_key into wk from public.hq_workforce_workers order by worker_key limit 1;
 if wk is null then raise exception 'fixture requires one Worker Engine worker'; end if;
 insert into public.hq_workforce_worker_competencies(worker_key,competency_key,proficiency,reliability,certification_status,evidence,allowed_scope_types,jurisdictions)
 values(wk,'fixture.legacy.competency',.95,.9,'certified','{"mode":"legacy_fixture"}',array['platform_internal','global'],array['global']);
end $$;

create table public.hq_workforce_capability_edges (
 id uuid primary key default gen_random_uuid(), from_skill_manifest_id uuid not null, to_skill_manifest_id uuid not null,
 relation_type text not null, input_mapping jsonb not null default '{}'::jsonb, output_mapping jsonb not null default '{}'::jsonb,
 condition_contract jsonb not null default '{}'::jsonb, priority integer not null default 100,
 enabled boolean not null default false, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index hq_workforce_capability_edges_from_idx on public.hq_workforce_capability_edges(from_skill_manifest_id,enabled,priority);
create index hq_workforce_capability_edges_to_idx on public.hq_workforce_capability_edges(to_skill_manifest_id,enabled,priority);

create table public.hq_workforce_collaborations (
 id uuid primary key default gen_random_uuid(), trace_id uuid, plan_id uuid, from_worker_key text not null,
 to_worker_key text not null, collaboration_type text not null, requested_competencies text[] not null default '{}',
 authority_snapshot jsonb not null default '{}'::jsonb, status text not null, created_at timestamptz not null default clock_timestamp()
);
create table public.hq_workforce_competency_capabilities (
 id uuid primary key default gen_random_uuid(), competency_key text not null, skill_key text not null, version integer not null default 1,
 min_skill_version integer not null default 1, required boolean not null default true, priority integer not null default 100,
 status text not null default 'active', approved_at timestamptz, created_at timestamptz not null default clock_timestamp()
);
insert into public.hq_workforce_competency_capabilities(competency_key,skill_key) values('fixture.legacy.competency','fixture.legacy.skill');

create table public.hq_workforce_skill_resources (
 skill_manifest_id uuid not null, resource_id uuid not null, usage_role text not null, required boolean not null default true,
 operation text not null, constraints jsonb not null default '{}'::jsonb, created_at timestamptz not null default clock_timestamp()
);
insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,operation)
select gen_random_uuid(),id,'input','read' from public.hq_workforce_resources order by resource_key limit 1;

create table public.hq_workforce_evaluations (
 id uuid primary key default gen_random_uuid(), trace_id uuid, objective_id uuid, plan_id uuid, worker_key text,
 skill_manifest_id uuid, resource_id uuid, predicted_confidence numeric, predicted_outcome jsonb, observed_outcome jsonb,
 score numeric, human_agreement numeric, latency_ms bigint, useful boolean, evaluator_key text,
 created_at timestamptz not null default clock_timestamp()
);
create table public.hq_workforce_architecture_components (
 component_key text primary key, component_type text not null, lineage text, disposition text, canonical boolean not null default false,
 replacement_component_key text, rationale text, activation_allowed boolean not null default false, updated_at timestamptz not null default clock_timestamp()
);
insert into public.hq_workforce_architecture_components(component_key,component_type,lineage,disposition,rationale)
values('legacy_fixture','resource_fabric','R1.3X-production-only','supersede','fixture');
create table public.hq_workforce_calibration (
 dimension_type text not null, dimension_key text not null, sample_count bigint not null default 0,
 mean_predicted numeric, mean_observed numeric, calibration_error numeric, reliability numeric,
 last_evaluated_at timestamptz, updated_at timestamptz not null default clock_timestamp()
);
create table public.hq_workforce_skill_candidates (
 id uuid primary key default gen_random_uuid(), candidate_key text not null, detected_gap jsonb not null default '{}'::jsonb,
 proposed_manifest jsonb not null default '{}'::jsonb, proposed_tests jsonb not null default '[]'::jsonb,
 benchmark_contract jsonb not null default '{}'::jsonb, adversarial_cases jsonb not null default '[]'::jsonb,
 evidence jsonb not null default '{}'::jsonb, status text not null, certification_allowed boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table public.hq_workforce_factory_recommendations (
 id uuid primary key default gen_random_uuid(), trace_id uuid, objective_id uuid, diagnosis jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '{}'::jsonb, proposed_action jsonb not null default '{}'::jsonb,
 worker_creation_recommended boolean not null default false, status text not null, created_at timestamptz not null default clock_timestamp()
);
create table public.hq_workforce_memory (
 id uuid primary key default gen_random_uuid(), memory_key text not null, version integer not null default 1,
 memory_type text not null, content jsonb not null default '{}'::jsonb, provenance jsonb not null default '{}'::jsonb,
 confidence numeric, scope_type text, scope_key text, data_classifications text[] not null default '{}', jurisdictions text[] not null default '{}',
 authoritative boolean not null default false, valid_from timestamptz, valid_until timestamptz, supersedes_id uuid,
 contradiction_group text, retention_until timestamptz, created_at timestamptz not null default clock_timestamp()
);

create or replace function public.hq_workforce_discover_shadow_resources(p_scope_type text,p_jurisdiction text,p_operation text,p_limit integer)
returns setof public.hq_workforce_resources language sql stable as $$
 select * from public.hq_workforce_resources where enabled and shadow_capable limit greatest(1,least(coalesce(p_limit,10),100));
$$;
