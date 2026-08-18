-- WE-R1.3X historical lineage data bridge.
-- Ordered after canonical X3 capability/competency (150910) and X4 resources (150920).
-- Converts only semantics that have a deterministic one-to-one mapping. Ambiguous
-- historical mappings remain preserved in worker_engine_legacy_archive and are never
-- silently promoted into canonical authority.
-- NON-ACTIVATING.

do $guard$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'R1.3X lineage data bridge requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0) <> 0
     or coalesce(ec.runtime_max_risk,0) <> 0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'R1.3X lineage data bridge violated fail-closed runtime boundary';
  end if;
end
$guard$;

-- Worker competency evidence maps deterministically: the historical contract used
-- allowed_scope_types where the canonical X3 contract uses scope_types. Capacity
-- profile had no canonical equivalent and is retained inside evidence.
do $competencies$
declare v_source bigint; v_target bigint;
begin
  if to_regclass('worker_engine_legacy_archive.hq_workforce_worker_competencies') is null then return; end if;
  if to_regclass('public.hq_workforce_worker_competencies') is null then raise exception 'canonical worker competencies missing'; end if;

  select count(*) into v_source from worker_engine_legacy_archive.hq_workforce_worker_competencies;
  insert into public.hq_workforce_worker_competencies(
    id,worker_key,competency_key,version,proficiency,reliability,sample_count,
    certification_status,evidence,scope_types,jurisdictions,last_evaluated_at,
    expires_at,created_at,updated_at
  )
  select id,worker_key,competency_key,version,proficiency,reliability,0,
         certification_status,
         coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
           'lineage_convergence',jsonb_build_object(
             'source','production-only WE-R1.3X 20260815053502..20260815054004',
             'legacy_capacity_profile',coalesce(capacity_profile,'{}'::jsonb),
             'mapping','allowed_scope_types -> scope_types'
           )
         ),
         allowed_scope_types,jurisdictions,last_evaluated_at,expires_at,created_at,updated_at
  from worker_engine_legacy_archive.hq_workforce_worker_competencies
  on conflict (worker_key,competency_key,version) do nothing;

  select count(*) into v_target
  from public.hq_workforce_worker_competencies c
  join worker_engine_legacy_archive.hq_workforce_worker_competencies l
    using(worker_key,competency_key,version);
  if v_target <> v_source then
    raise exception 'R1.3X lineage competency preservation mismatch source=% target=%',v_source,v_target;
  end if;
end
$competencies$;

-- Historical resources map deterministically to canonical resource registry records.
-- No inferred reliability is invented. The complete retired contract is retained in
-- provenance/interface_contract as well as the lossless archive table.
do $resources$
declare v_source bigint; v_target bigint;
begin
  if to_regclass('worker_engine_legacy_archive.hq_workforce_resources') is null then return; end if;
  if to_regclass('public.hq_workforce_resources') is null then raise exception 'canonical resources missing'; end if;

  if exists (
    select 1 from worker_engine_legacy_archive.hq_workforce_resources
    where resource_type not in ('table','view','rpc','function','api','repository','document','dataset','search','model','human','tool','queue','other')
  ) then raise exception 'R1.3X lineage resource type outside deterministic mapping'; end if;

  select count(*) into v_source from worker_engine_legacy_archive.hq_workforce_resources;
  insert into public.hq_workforce_resources(
    id,resource_key,version,resource_kind,display_name,provider_key,enabled,shadow_capable,
    health_status,reliability,cost_per_unit,cost_unit,latency_class,required_autonomy,risk_class,
    allowed_scope_types,jurisdictions,allowed_data_classifications,quota_contract,interface_contract,
    provenance,valid_from,valid_until,created_at,updated_at
  )
  select
    id,resource_key,version,
    case
      when resource_type in ('table','view','dataset','search') then 'data_source'
      when resource_type in ('rpc','function','api') then 'internal_api'
      when resource_type in ('repository','document') then 'document'
      when resource_type='model' then 'model'
      when resource_type='human' then 'human_reviewer'
      when resource_type='tool' then 'tool'
      when resource_type='queue' then 'queue'
      else 'service'
    end,
    display_name,owner_key,enabled,shadow_capable,health_status,null,
    case when jsonb_typeof(cost_profile->'unit_cost')='number' then (cost_profile->>'unit_cost')::numeric else 0 end,
    coalesce(nullif(cost_profile->>'unit',''),'count'),
    case coalesce(latency_profile->>'class','') when 'local_database' then 0 else 0 end,
    required_autonomy,risk_class,allowed_scope_types,jurisdictions,data_classifications,
    coalesce(quota_policy,'{}'::jsonb),
    jsonb_build_object(
      'legacy_resource_type',resource_type,
      'description',description,
      'allowed_operations',coalesce(allowed_operations,'{}'::text[]),
      'freshness_policy',coalesce(freshness_policy,'{}'::jsonb),
      'legacy_metadata',coalesce(metadata,'{}'::jsonb)
    ),
    coalesce(provenance,'{}'::jsonb) || jsonb_build_object(
      'lineage_convergence',jsonb_build_object(
        'source','production-only WE-R1.3X 20260815053502..20260815054004',
        'legacy_owner_key',owner_key,
        'legacy_trust_tier',trust_tier,
        'legacy_latency_profile',coalesce(latency_profile,'{}'::jsonb),
        'legacy_immutable_version_key',immutable_version_key
      )
    ),
    created_at,null,created_at,updated_at
  from worker_engine_legacy_archive.hq_workforce_resources
  on conflict (resource_key,version) do nothing;

  select count(*) into v_target
  from public.hq_workforce_resources c
  join worker_engine_legacy_archive.hq_workforce_resources l using(resource_key,version);
  if v_target <> v_source then
    raise exception 'R1.3X lineage resource preservation mismatch source=% target=%',v_source,v_target;
  end if;
end
$resources$;

-- Ambiguous historical semantics are intentionally NOT promoted:
--   hq_workforce_competency_capabilities (competency -> skill version)
--   hq_workforce_skill_resources       (skill manifest -> resource)
-- Neither is equivalent to canonical capability_competencies/capability_resources
-- without a certified skill->capability semantic mapping. The archive remains the
-- authoritative historical evidence until a separately governed reconciliation exists.

do $verify$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  if to_regclass('public.hq_workforce_capabilities') is null
     or to_regclass('public.hq_workforce_capability_edges') is null
     or to_regclass('public.hq_workforce_worker_competencies') is null
     or to_regclass('public.hq_workforce_resources') is null then
    raise exception 'R1.3X lineage data bridge canonical ontology incomplete';
  end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'R1.3X lineage data bridge postcondition violated fail-closed boundary';
  end if;
end
$verify$;
