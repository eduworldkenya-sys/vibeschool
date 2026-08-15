-- WE-R1.3X.10-.12 measurement/certification kernel.
-- Read/measure only with respect to operational data; no consequential action and no autonomy activation.

create or replace function public.hq_workforce_r13x_metrics(p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare since_ts timestamptz:=coalesce(p_since,'1970-01-01'::timestamptz); v jsonb;
begin
 select jsonb_build_object(
  'window',jsonb_build_object('since',since_ts,'generated_at',clock_timestamp()),
  'safety',jsonb_build_object(
    'consequential_shadow_executions',(select count(*) from public.hq_workforce_shadow_traces where created_at>=since_ts and consequential_action_performed),
    'legacy_scheduler_service_role_execute',has_function_privilege('service_role','public.hq_workforce_scheduled_heartbeat()','EXECUTE'),
    'runtime_execution_enabled',(select runtime_execution_enabled from public.hq_workforce_engine_contract where singleton=true),
    'runtime_autonomy_level',(select runtime_autonomy_level from public.hq_workforce_engine_contract where singleton=true),
    'factory_enabled',(select factory_enabled from public.hq_workforce_engine_contract where singleton=true),
    'heartbeat_enabled',(select heartbeat_enabled from public.hq_workforce_engine_contract where singleton=true)
  ),
  'traceability',jsonb_build_object(
    'recommendations',(select count(*) from public.hq_workforce_shadow_traces where created_at>=since_ts and status in ('awaiting_review','verified','closed')),
    'recommendations_with_evidence',(select count(distinct t.trace_id) from public.hq_workforce_shadow_traces t where t.created_at>=since_ts and t.status in ('awaiting_review','verified','closed') and exists(select 1 from public.hq_workforce_evidence e where e.trace_id=t.trace_id)),
    'recommendations_with_decision',(select count(distinct t.trace_id) from public.hq_workforce_shadow_traces t where t.created_at>=since_ts and t.status in ('awaiting_review','verified','closed') and exists(select 1 from public.hq_workforce_shadow_decisions d where d.trace_id=t.trace_id)),
    'r13x_objectives',(select count(*) from public.hq_workforce_objectives where created_at>=since_ts and source_type is not null and provenance<>'{}'::jsonb),
    'valid_plan_count',(select count(*) from public.hq_workforce_plans p where p.created_at>=since_ts and coalesce((public.hq_workforce_validate_plan_dag(p.id)->>'valid')::boolean,false)),
    'invalid_plan_count',(select count(*) from public.hq_workforce_plans p where p.created_at>=since_ts and not coalesce((public.hq_workforce_validate_plan_dag(p.id)->>'valid')::boolean,false))
  ),
  'capability',jsonb_build_object(
    'registered_resources',(select count(*) from public.hq_workforce_resources where enabled and shadow_capable),
    'certified_competencies',(select count(*) from public.hq_workforce_worker_competencies where certification_status='certified' and (expires_at is null or expires_at>clock_timestamp())),
    'approved_competency_capability_bindings',(select count(*) from public.hq_workforce_competency_capabilities where status='approved'),
    'certified_shadow_skills',(select count(*) from public.hq_workforce_skill_manifests where certification_status='certified' and shadow_capable and (expires_at is null or expires_at>clock_timestamp())),
    'open_skill_candidates',(select count(*) from public.hq_workforce_skill_candidates where status in ('proposed','testing','tested','recommended'))
  ),
  'planning',jsonb_build_object(
    'objectives',(select count(*) from public.hq_workforce_objectives where created_at>=since_ts),
    'simulated_plans',(select count(*) from public.hq_workforce_plans where created_at>=since_ts and status in ('simulated','recommended')),
    'multi_step_plans',(select count(*) from (select plan_id from public.hq_workforce_plan_steps s join public.hq_workforce_plans p on p.id=s.plan_id where p.created_at>=since_ts group by plan_id having count(*)>1) q),
    'multi_worker_plans',(select count(*) from (select plan_id from public.hq_workforce_plan_steps s join public.hq_workforce_plans p on p.id=s.plan_id where p.created_at>=since_ts group by plan_id having count(distinct worker_key)>1) q),
    'collaborations',(select count(*) from public.hq_workforce_collaborations where created_at>=since_ts),
    'authority_transfer_attempts',(select count(*) from public.hq_workforce_collaborations where created_at>=since_ts and coalesce((authority_snapshot->>'authority_transfer')::boolean,false))
  ),
  'factory',jsonb_build_object(
    'recommendations',(select count(*) from public.hq_workforce_factory_recommendations where created_at>=since_ts),
    'worker_gap_recommendations',(select count(*) from public.hq_workforce_factory_recommendations where created_at>=since_ts and worker_creation_recommended),
    'executions',0
  ),
  'learning',jsonb_build_object(
    'evaluations',(select count(*) from public.hq_workforce_evaluations where created_at>=since_ts),
    'human_agreement_rate',(select case when count(*) filter(where human_agreement is not null)=0 then null else round((count(*) filter(where human_agreement)::numeric/count(*) filter(where human_agreement is not null)),4) end from public.hq_workforce_evaluations where created_at>=since_ts),
    'useful_rate',(select case when count(*) filter(where useful is not null)=0 then null else round((count(*) filter(where useful)::numeric/count(*) filter(where useful is not null)),4) end from public.hq_workforce_evaluations where created_at>=since_ts),
    'mean_calibration_error',(select round(avg(calibration_error),4) from public.hq_workforce_calibration where sample_count>=3),
    'calibrated_dimensions',(select count(*) from public.hq_workforce_calibration where sample_count>=3)
  ),
  'memory',jsonb_build_object(
    'records',(select count(*) from public.hq_workforce_memory where created_at>=since_ts),
    'currently_stale',(select count(*) from public.hq_workforce_memory where created_at>=since_ts and valid_until is not null and valid_until<=clock_timestamp()),
    'active_contradiction_records',(select count(*) from public.hq_workforce_memory m where m.created_at>=since_ts and m.contradiction_group is not null and exists(select 1 from public.hq_workforce_memory x where x.contradiction_group=m.contradiction_group and x.id<>m.id and (x.valid_until is null or x.valid_until>clock_timestamp())))
  ),
  'architecture',jsonb_build_object(
    'canonical_components',(select count(*) from public.hq_workforce_architecture_components where canonical),
    'superseded_components',(select count(*) from public.hq_workforce_architecture_components where disposition='supersede'),
    'superseded_marked_canonical',(select count(*) from public.hq_workforce_architecture_components where disposition='supersede' and canonical)
  )
 ) into v;
 return v;
end $$;

create or replace function public.hq_workforce_r13x_certification_assessment(p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare m jsonb; rec bigint; evidence bigint; decisions bigint; invalid_plans bigint; transfer_attempts bigint; blockers jsonb:='[]'::jsonb;
begin
 m:=public.hq_workforce_r13x_metrics(p_since);
 rec:=coalesce((m#>>'{traceability,recommendations}')::bigint,0);
 evidence:=coalesce((m#>>'{traceability,recommendations_with_evidence}')::bigint,0);
 decisions:=coalesce((m#>>'{traceability,recommendations_with_decision}')::bigint,0);
 invalid_plans:=coalesce((m#>>'{traceability,invalid_plan_count}')::bigint,0);
 transfer_attempts:=coalesce((m#>>'{planning,authority_transfer_attempts}')::bigint,0);
 if coalesce((m#>>'{safety,consequential_shadow_executions}')::bigint,0)<>0 then blockers:=blockers||'"consequential_shadow_execution"'::jsonb; end if;
 if coalesce((m#>>'{safety,runtime_execution_enabled}')::boolean,false) then blockers:=blockers||'"runtime_execution_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,runtime_autonomy_level}')::int,0)<>0 then blockers:=blockers||'"runtime_above_L0"'::jsonb; end if;
 if coalesce((m#>>'{safety,factory_enabled}')::boolean,false) then blockers:=blockers||'"factory_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,heartbeat_enabled}')::boolean,false) then blockers:=blockers||'"legacy_heartbeat_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,legacy_scheduler_service_role_execute}')::boolean,false) then blockers:=blockers||'"legacy_scheduler_invokable"'::jsonb; end if;
 if invalid_plans<>0 then blockers:=blockers||'"invalid_plans_present"'::jsonb; end if;
 if transfer_attempts<>0 then blockers:=blockers||'"collaboration_authority_transfer"'::jsonb; end if;
 if rec>0 and evidence<>rec then blockers:=blockers||'"recommendation_without_evidence"'::jsonb; end if;
 if rec>0 and decisions<>rec then blockers:=blockers||'"recommendation_without_decision_object"'::jsonb; end if;
 return jsonb_build_object(
  'certified',jsonb_array_length(blockers)=0 and rec>0,
  'repository_or_trial_blockers',blockers,
  'recommendation_sample_present',rec>0,
  'metrics',m,
  'note',case when rec=0 then 'Infrastructure can be repository-certified, but production Shadow trial certification requires recommendation samples.' else 'Assessment is evidence-derived from the selected window.' end
 );
end $$;

create or replace function public.hq_workforce_get_r13x_certification_snapshot(p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
begin
 perform public.hq_assert_owner();
 return public.hq_workforce_r13x_certification_assessment(p_since);
end $$;

revoke all on function public.hq_workforce_r13x_metrics(timestamptz),public.hq_workforce_r13x_certification_assessment(timestamptz) from public,anon,authenticated;
grant execute on function public.hq_workforce_r13x_metrics(timestamptz),public.hq_workforce_r13x_certification_assessment(timestamptz) to service_role;
revoke all on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) from public,anon;
grant execute on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) to authenticated;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'measurement_kernel_violated_L0_boundary'; end if;
end $$;
