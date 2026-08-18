-- WE-R1.3X historical lineage convergence.
--
-- GENESIS:
-- Production contains an earlier R1.3X generation (20260815053502..20260815054004)
-- whose source migrations are no longer present in repository history. That generation
-- reused names later assigned to the canonical X3+ ontology, but with incompatible
-- schemas. CREATE TABLE IF NOT EXISTS therefore cannot establish semantic parity.
--
-- This migration is deliberately ordered between canonical X2 (150900) and X3 (150910).
-- On a clean rebuild it is a no-op. On the known historical production lineage it
-- validates exact fingerprints, quarantines the entire superseded overlay as one unit,
-- and records an immutable convergence manifest. Unknown shapes fail closed.
--
-- NON-ACTIVATING: runtime, heartbeat, Factory, Shadow and autonomous execution remain OFF.
-- access: owner-only worker_engine_legacy_archive.r13x_lineage_manifest
-- authorization-test: worker_engine_legacy_archive.r13x_lineage_manifest public/anon/authenticated/service_role denied; migration owner only

create schema if not exists worker_engine_legacy_archive;
revoke all on schema worker_engine_legacy_archive from public, anon, authenticated, service_role;

create table if not exists worker_engine_legacy_archive.r13x_lineage_manifest (
  object_name text primary key,
  object_kind text not null,
  observed_columns text,
  observed_rows bigint,
  disposition text not null,
  canonical_successor text,
  reason text not null,
  captured_at timestamptz not null default clock_timestamp()
);
alter table worker_engine_legacy_archive.r13x_lineage_manifest enable row level security;
revoke all on table worker_engine_legacy_archive.r13x_lineage_manifest from public, anon, authenticated, service_role;

do $guard$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'R1.3X lineage convergence requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0) <> 0
     or coalesce(ec.runtime_max_risk,0) <> 0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'R1.3X lineage convergence violated fail-closed runtime boundary';
  end if;
end
$guard$;

do $converge$
declare
  r record;
  v_cols text;
  v_rows bigint;
begin
  for r in
    select * from (values
      ('hq_workforce_capability_edges','id,from_skill_manifest_id,to_skill_manifest_id,relation_type,input_mapping,output_mapping,condition_contract,priority,enabled,created_at,updated_at','public.hq_workforce_capability_edges','archive_zero_row_name_collision'),
      ('hq_workforce_resources','id,resource_key,version,resource_type,display_name,description,owner_key,provenance,trust_tier,freshness_policy,data_classifications,jurisdictions,allowed_scope_types,allowed_operations,required_autonomy,risk_class,cost_profile,quota_policy,latency_profile,health_status,enabled,shadow_capable,immutable_version_key,metadata,created_at,updated_at','public.hq_workforce_resources','archive_then_transform'),
      ('hq_workforce_worker_competencies','id,worker_key,competency_key,version,proficiency,reliability,certification_status,evidence,allowed_scope_types,jurisdictions,capacity_profile,last_evaluated_at,expires_at,created_at,updated_at','public.hq_workforce_worker_competencies','archive_then_transform'),
      ('hq_workforce_collaborations','id,trace_id,plan_id,from_worker_key,to_worker_key,collaboration_type,requested_competencies,authority_snapshot,status,created_at','public.hq_workforce_collaborations','archive_semantic_mismatch'),
      ('hq_workforce_competency_capabilities','id,competency_key,skill_key,version,min_skill_version,required,priority,status,approved_at,created_at','public.hq_workforce_capability_competencies','archive_semantic_remap_required'),
      ('hq_workforce_skill_resources','skill_manifest_id,resource_id,usage_role,required,operation,constraints,created_at','public.hq_workforce_capability_resources','archive_semantic_remap_required'),
      ('hq_workforce_evaluations','id,trace_id,objective_id,plan_id,worker_key,skill_manifest_id,resource_id,predicted_confidence,predicted_outcome,observed_outcome,score,human_agreement,latency_ms,useful,evaluator_key,created_at',null,'archive_superseded_measurement'),
      ('hq_workforce_architecture_components','component_key,component_type,lineage,disposition,canonical,replacement_component_key,rationale,activation_allowed,updated_at',null,'archive_historical_architecture_evidence'),
      ('hq_workforce_calibration','dimension_type,dimension_key,sample_count,mean_predicted,mean_observed,calibration_error,reliability,last_evaluated_at,updated_at',null,'archive_superseded_measurement'),
      ('hq_workforce_skill_candidates','id,candidate_key,detected_gap,proposed_manifest,proposed_tests,benchmark_contract,adversarial_cases,evidence,status,certification_allowed,created_at,updated_at',null,'archive_superseded_factory'),
      ('hq_workforce_factory_recommendations','id,trace_id,objective_id,diagnosis,evidence,proposed_action,worker_creation_recommended,status,created_at',null,'archive_superseded_factory'),
      ('hq_workforce_memory','id,memory_key,version,memory_type,content,provenance,confidence,scope_type,scope_key,data_classifications,jurisdictions,authoritative,valid_from,valid_until,supersedes_id,contradiction_group,retention_until,created_at','public.hq_workforce_memory_records','archive_superseded_memory')
    ) as x(relname,expected_cols,successor,disposition)
  loop
    if to_regclass('public.'||r.relname) is null then continue; end if;

    select string_agg(column_name,',' order by ordinal_position)
      into v_cols
    from information_schema.columns
    where table_schema='public' and table_name=r.relname;

    if r.relname='hq_workforce_capability_edges' and v_cols='id,from_capability_id,to_capability_id,relation_type,condition_contract,priority,enabled,created_at,updated_at' then continue; end if;
    if r.relname='hq_workforce_resources' and position('resource_kind' in coalesce(v_cols,''))>0 and position('cost_per_unit' in coalesce(v_cols,''))>0 then continue; end if;
    if r.relname='hq_workforce_worker_competencies' and position('scope_types' in coalesce(v_cols,''))>0 and position('sample_count' in coalesce(v_cols,''))>0 then continue; end if;
    if r.relname='hq_workforce_collaborations' and position('objective_id' in coalesce(v_cols,''))>0 and position('authority_transfer' in coalesce(v_cols,''))>0 then continue; end if;

    if v_cols is distinct from r.expected_cols then
      raise exception 'R1.3X lineage convergence blocked: %. unknown fingerprint: %', r.relname, v_cols;
    end if;

    execute format('select count(*) from public.%I',r.relname) into v_rows;
    if r.relname in ('hq_workforce_capability_edges','hq_workforce_collaborations','hq_workforce_evaluations','hq_workforce_calibration','hq_workforce_skill_candidates','hq_workforce_factory_recommendations','hq_workforce_memory') and v_rows <> 0 then
      raise exception 'R1.3X lineage convergence blocked: % unexpectedly contains % rows',r.relname,v_rows;
    end if;

    if to_regclass('worker_engine_legacy_archive.'||r.relname) is not null then
      raise exception 'R1.3X lineage convergence blocked: archive collision for %',r.relname;
    end if;

    insert into worker_engine_legacy_archive.r13x_lineage_manifest(object_name,object_kind,observed_columns,observed_rows,disposition,canonical_successor,reason)
    values(r.relname,'table',v_cols,v_rows,r.disposition,r.successor,'Superseded production-only WE-R1.3X generation 20260815053502..20260815054004')
    on conflict (object_name) do nothing;

    execute format('alter table public.%I set schema worker_engine_legacy_archive',r.relname);
  end loop;
end
$converge$;

-- Exact-identifier regexes prevent hq_workforce_memory from matching canonical
-- hq_workforce_memory_records / hq_workforce_memory_events.
do $functions$
declare r record;
begin
  for r in
    select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (
        pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_capability_edges([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_resources([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_worker_competencies([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_competency_capabilities([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_skill_resources([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_evaluations([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_architecture_components([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_calibration([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_skill_candidates([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_factory_recommendations([^A-Za-z0-9_]|$)'
        or pg_get_functiondef(p.oid) ~ '(^|[^A-Za-z0-9_])hq_workforce_memory([^A-Za-z0-9_]|$)'
      )
  loop
    insert into worker_engine_legacy_archive.r13x_lineage_manifest(object_name,object_kind,disposition,reason)
    values(r.proname||'('||r.args||')','function','archive_superseded_api','Function bound to superseded production-only WE-R1.3X overlay')
    on conflict (object_name) do nothing;
    execute format('alter function public.%I(%s) set schema worker_engine_legacy_archive',r.proname,r.args);
  end loop;
end
$functions$;

revoke all on all tables in schema worker_engine_legacy_archive from public, anon, authenticated, service_role;
revoke all on all sequences in schema worker_engine_legacy_archive from public, anon, authenticated, service_role;
revoke all on all functions in schema worker_engine_legacy_archive from public, anon, authenticated, service_role;

comment on schema worker_engine_legacy_archive is
  'Lossless private archive for superseded Worker Engine generations. Never an execution authority source.';
