-- WE-R1.3X Control Room intelligence read model. Owner-only; no direct authenticated table grants.

create or replace function public.hq_workforce_get_intelligence_snapshot(p_recent_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare lim int:=greatest(1,least(coalesce(p_recent_limit,30),100)); v jsonb;
begin
 perform public.hq_assert_owner();
 select jsonb_build_object(
  'generated_at',clock_timestamp(),
  'counts',jsonb_build_object(
    'resources',(select count(*) from public.hq_workforce_resources),
    'enabled_resources',(select count(*) from public.hq_workforce_resources where enabled and shadow_capable),
    'certified_competencies',(select count(*) from public.hq_workforce_worker_competencies where certification_status='certified'),
    'capability_edges',(select count(*) from public.hq_workforce_capability_edges where enabled),
    'objectives',(select count(*) from public.hq_workforce_objectives),
    'plans',(select count(*) from public.hq_workforce_plans),
    'collaborations',(select count(*) from public.hq_workforce_collaborations),
    'skill_candidates',(select count(*) from public.hq_workforce_skill_candidates where status in ('proposed','testing','tested','recommended')),
    'evaluations',(select count(*) from public.hq_workforce_evaluations),
    'memories',(select count(*) from public.hq_workforce_memory),
    'factory_recommendations',(select count(*) from public.hq_workforce_factory_recommendations where status='proposed'),
    'canonical_components',(select count(*) from public.hq_workforce_architecture_components where canonical),
    'superseded_components',(select count(*) from public.hq_workforce_architecture_components where disposition='supersede')
  ),
  'architecture',coalesce((select jsonb_agg(to_jsonb(x) order by x.canonical desc,x.component_type,x.component_key) from (select component_key,component_type,lineage,disposition,canonical,replacement_component_key,rationale,activation_allowed,updated_at from public.hq_workforce_architecture_components order by canonical desc,component_type,component_key limit lim) x),'[]'::jsonb),
  'resources',coalesce((select jsonb_agg(to_jsonb(x) order by x.enabled desc,x.trust_tier desc,x.resource_key) from (select id,resource_key,version,resource_type,display_name,trust_tier,health_status,enabled,shadow_capable,required_autonomy,risk_class,data_classifications,jurisdictions,allowed_scope_types,allowed_operations,cost_profile,quota_policy,latency_profile,updated_at from public.hq_workforce_resources order by enabled desc,trust_tier desc,resource_key limit lim) x),'[]'::jsonb),
  'competencies',coalesce((select jsonb_agg(to_jsonb(x) order by x.certification_status,x.proficiency desc,x.worker_key) from (select worker_key,competency_key,version,proficiency,reliability,certification_status,allowed_scope_types,jurisdictions,last_evaluated_at,expires_at from public.hq_workforce_worker_competencies order by case certification_status when 'certified' then 1 when 'tested' then 2 else 3 end,proficiency desc limit lim) x),'[]'::jsonb),
  'objectives',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,trace_id,objective_key,statement,scope_type,scope_key,jurisdiction,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status,created_at,updated_at from public.hq_workforce_objectives order by created_at desc limit lim) x),'[]'::jsonb),
  'plans',coalesce((select jsonb_agg(jsonb_build_object('plan',to_jsonb(p),'steps',coalesce((select jsonb_agg(to_jsonb(s) order by s.ordinal) from public.hq_workforce_plan_steps s where s.plan_id=p.id),'[]'::jsonb)) order by p.created_at desc) from (select id,objective_id,plan_version,strategy_key,status,expected_quality,confidence,required_risk,required_autonomy,estimated_cost,estimated_latency_ms,rationale,verification_contract,created_at from public.hq_workforce_plans order by created_at desc limit lim) p),'[]'::jsonb),
  'collaborations',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,trace_id,plan_id,from_worker_key,to_worker_key,collaboration_type,requested_competencies,authority_snapshot,status,created_at from public.hq_workforce_collaborations order by created_at desc limit lim) x),'[]'::jsonb),
  'skill_candidates',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,candidate_key,detected_gap,proposed_manifest,benchmark_contract,status,certification_allowed,created_at,updated_at from public.hq_workforce_skill_candidates order by created_at desc limit lim) x),'[]'::jsonb),
  'calibration',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (select dimension_type,dimension_key,sample_count,mean_predicted,mean_observed,calibration_error,reliability,last_evaluated_at,updated_at from public.hq_workforce_calibration order by updated_at desc limit lim) x),'[]'::jsonb),
  'memory',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,memory_key,version,memory_type,confidence,scope_type,scope_key,data_classifications,jurisdictions,authoritative,valid_from,valid_until,contradiction_group,retention_until,created_at from public.hq_workforce_memory order by created_at desc limit lim) x),'[]'::jsonb),
  'factory_recommendations',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,trace_id,objective_id,diagnosis,evidence,proposed_action,worker_creation_recommended,status,created_at from public.hq_workforce_factory_recommendations order by created_at desc limit lim) x),'[]'::jsonb)
 ) into v;
 return v;
end $$;

revoke all on function public.hq_workforce_get_intelligence_snapshot(integer) from public,anon;
grant execute on function public.hq_workforce_get_intelligence_snapshot(integer) to authenticated;
