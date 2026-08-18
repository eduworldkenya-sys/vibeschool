-- WE-R1.4.21 forensic/readiness control regression.
begin;

do $$
declare s jsonb; d text;
begin
  if to_regprocedure('public.hq_workforce_execution_telemetry_completeness(uuid)') is null then raise exception 'telemetry completeness function missing'; end if;
  if to_regprocedure('public.hq_workforce_get_execution_dossier(uuid)') is null then raise exception 'execution dossier function missing'; end if;
  if to_regprocedure('public.hq_workforce_list_execution_attention(integer)') is null then raise exception 'execution attention function missing'; end if;
  if to_regprocedure('public.hq_workforce_production_readiness_scorecard()') is null then raise exception 'readiness scorecard missing'; end if;

  if has_function_privilege('anon','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE') then
    raise exception 'dossier not owner-only';
  end if;
  if not has_function_privilege('authenticated','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE') then
    raise exception 'authenticated owner route cannot reach dossier gate';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_get_execution_dossier(uuid)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 then raise exception 'dossier owner assertion missing'; end if;

  if has_function_privilege('authenticated','public.hq_workforce_production_readiness_scorecard()','EXECUTE') then
    raise exception 'readiness scorecard exposed to product role';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_production_readiness_scorecard()','EXECUTE') then
    raise exception 'service diagnostics cannot execute readiness scorecard';
  end if;

  s:=public.hq_workforce_production_readiness_scorecard();
  if not coalesce((s->>'schema_ready_for_controlled_canary')::boolean,false) then raise exception 'readiness scorecard not green:%',s; end if;
  if coalesce((s->>'production_runtime_activated')::boolean,true) then raise exception 'readiness scorecard activated runtime'; end if;
  if not coalesce((s->'checks'->>'fail_closed_engine')::boolean,false) then raise exception 'fail-closed check false'; end if;
  if not coalesce((s->'checks'->>'single_canonical_gateway')::boolean,false) then raise exception 'canonical gateway check false'; end if;
  if not coalesce((s->'checks'->>'durable_breaker_history')::boolean,false) then raise exception 'breaker history check false'; end if;
  if not coalesce((s->'checks'->>'bound_independent_verifier')::boolean,false) then raise exception 'verifier binding check false'; end if;
  if not coalesce((s->'checks'->>'canonical_forensic_read_model')::boolean,false) then raise exception 'forensic read model check false'; end if;
end $$;

-- Unknown tasks fail closed and never fabricate a dossier.
do $$
declare c jsonb;
begin
  c:=public.hq_workforce_execution_telemetry_completeness(gen_random_uuid());
  if coalesce((c->>'complete')::boolean,true) then raise exception 'unknown task marked complete'; end if;
  if c->>'mode'<>'missing' then raise exception 'unknown task mode invalid:%',c; end if;
end $$;

-- Installation remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.21 changed fail-closed posture';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.21 activated capability authority'; end if;
end $$;

rollback;
