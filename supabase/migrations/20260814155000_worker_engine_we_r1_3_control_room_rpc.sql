-- WE-R1.3.6: owner-only Worker Engine Control Room read model.
-- No runtime activation and no direct authenticated table grants.

create or replace function public.hq_workforce_get_control_room_snapshot(p_recent_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v jsonb;
  lim integer:=greatest(1,least(coalesce(p_recent_limit,30),100));
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'generated_at',clock_timestamp(),
    'engine',(
      select jsonb_build_object(
        'heartbeat_enabled',heartbeat_enabled,
        'factory_enabled',factory_enabled,
        'runtime_execution_enabled',runtime_execution_enabled,
        'runtime_autonomy_level',runtime_autonomy_level,
        'runtime_max_risk',runtime_max_risk,
        'runtime_anomaly_paused',runtime_anomaly_paused,
        'shadow_enabled',shadow_enabled,
        'shadow_scheduler_enabled',shadow_scheduler_enabled,
        'shadow_global_stop',shadow_global_stop,
        'shadow_anomaly_paused',shadow_anomaly_paused,
        'shadow_max_cycles_per_hour',shadow_max_cycles_per_hour,
        'shadow_max_candidates_per_cycle',shadow_max_candidates_per_cycle,
        'shadow_max_concurrency',shadow_max_concurrency,
        'shadow_max_retries',shadow_max_retries,
        'shadow_max_queue_depth',shadow_max_queue_depth,
        'updated_at',updated_at
      ) from public.hq_workforce_engine_contract where singleton=true
    ),
    'counts',jsonb_build_object(
      'workers',(select count(*) from public.hq_workforce_workers),
      'active_workers',(select count(*) from public.hq_workforce_workers where status='active'),
      'open_work_items',(select count(*) from public.hq_work_items where status in ('open','in_progress','waiting_approval')),
      'shadow_candidates',(select count(*) from public.hq_workforce_shadow_candidates where status in ('candidate','recommended','escalated')),
      'shadow_runs',(select count(*) from public.hq_workforce_shadow_runs),
      'decisions_waiting',(select count(*) from public.hq_workforce_shadow_decisions where state in ('proposed','awaiting_review','revise')),
      'certified_skills',(select count(*) from public.hq_workforce_skill_manifests where certification_status='certified'),
      'shadow_capable_skills',(select count(*) from public.hq_workforce_skill_manifests where certification_status='certified' and shadow_capable),
      'authority_denials',(select count(*) from public.hq_workforce_runtime_authorization_events where decision='deny'),
      'open_anomalies',(select count(*) from public.hq_workforce_shadow_anomalies where resolved_at is null),
      'dead_letters',(select count(*) from public.hq_workforce_dead_letters)
    ),
    'workers',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.status,x.worker_key)
      from (
        select worker_key,title,department_key,job_key,status,reasoning_mode,paid_ai_allowed,updated_at
        from public.hq_workforce_workers
        order by case status when 'active' then 1 when 'probation' then 2 when 'restricted' then 3 when 'suspended' then 4 else 5 end,worker_key
        limit lim
      ) x
    ),'[]'::jsonb),
    'jobs',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.priority desc,x.created_at)
      from (
        select id,department_key,work_type,priority,status,title,approval_required,due_at,created_at
        from public.hq_work_items
        where status in ('open','in_progress','waiting_approval')
        order by case priority when 'critical' then 4 when 'high' then 3 when 'normal' then 2 else 1 end desc,created_at
        limit lim
      ) x
    ),'[]'::jsonb),
    'shadow_candidates',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.priority desc,x.created_at)
      from (
        select id,trace_id,source_work_item_id,lane_key,worker_key,skill_manifest_id,priority,sla_due_at,status,reasoning_summary,confidence,created_at
        from public.hq_workforce_shadow_candidates
        order by priority desc,created_at desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'shadow_runs',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select trace_id,cycle_key,worker_key,lane_key,skill_manifest_id,scope_type,scope_ref,status,confidence,predicted_outcome,consequential_action_performed,started_at,completed_at,created_at
        from public.hq_workforce_shadow_runs
        order by created_at desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'decisions',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id,trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state,human_rationale,reviewed_by,reviewed_at,created_at,updated_at
        from public.hq_workforce_shadow_decisions
        order by created_at desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'skills',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.skill_key,x.version desc)
      from (
        select id,skill_key,version,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,certification_status,shadow_capable,immutable_version_key,certified_at,expires_at
        from public.hq_workforce_skill_manifests
        order by skill_key,version desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'authority',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.occurred_at desc)
      from (
        select id,worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref,occurred_at
        from public.hq_workforce_runtime_authorization_events
        order by occurred_at desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'evidence',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id,trace_id,evidence_kind,source_type,source_ref,observed_at,content_hash,classification,jurisdiction_key,tenant_key,created_at
        from public.hq_workforce_evidence
        order by created_at desc
        limit lim
      ) x
    ),'[]'::jsonb),
    'failures',jsonb_build_object(
      'anomalies',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (
          select id,trace_id,anomaly_key,severity,action,details,created_at,resolved_at
          from public.hq_workforce_shadow_anomalies
          order by created_at desc
          limit lim
        ) x
      ),'[]'::jsonb),
      'dead_letters',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (
          select id,task_id,worker_key,error_code,error_detail,attempts,created_at
          from public.hq_workforce_dead_letters
          order by created_at desc
          limit lim
        ) x
      ),'[]'::jsonb)
    ),
    'resources',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.recorded_at desc)
      from (
        select id,trace_id,worker_key,resource_kind,amount,unit,window_started_at,recorded_at
        from public.hq_workforce_shadow_resource_usage
        order by recorded_at desc
        limit lim
      ) x
    ),'[]'::jsonb)
  ) into v;

  return v;
end $$;

create or replace function public.hq_workforce_owner_review_shadow_decision(
  p_decision_id uuid,
  p_state text,
  p_rationale text default null
) returns public.hq_workforce_shadow_decisions
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.hq_assert_owner();
  return public.hq_workforce_shadow_review_decision(p_decision_id,p_state,p_rationale);
end $$;

revoke all on function public.hq_workforce_get_control_room_snapshot(integer) from public,anon;
revoke all on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text) from public,anon;
grant execute on function public.hq_workforce_get_control_room_snapshot(integer) to authenticated;
grant execute on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text) to authenticated;
