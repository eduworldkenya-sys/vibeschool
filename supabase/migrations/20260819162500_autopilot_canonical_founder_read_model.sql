-- VibeSchool Autopilot canonical Founder read model.
-- NON-ACTIVATING: read-only governance composition over existing Worker Engine/HQ truth.
-- access: owner-only public.hq_autopilot_founder_brief
-- access: owner-only public.hq_autopilot_constitution_snapshot
-- authorization-test: both RPCs require hq_assert_owner and deny public/anon/service_role.

create or replace function public.hq_autopilot_constitution_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_global_policy jsonb:='{}'::jsonb;
  v_active_authority integer:=0;
  v_tripped_breakers integer:=0;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_engine_contract_missing'; end if;

  select coalesce(to_jsonb(p),'{}'::jsonb) into v_global_policy
    from public.hq_workforce_runtime_policies p
   where p.status='active' and p.scope_kind='global' and p.scope_key='global'
   order by p.updated_at desc limit 1;

  select count(*) into v_active_authority
    from public.hq_workforce_capability_authority_grants
   where status='active'
     and activated_at is not null
     and activated_at<=clock_timestamp()
     and revoked_at is null
     and expires_at>clock_timestamp();
  select count(*) into v_tripped_breakers
    from public.hq_workforce_execution_breakers where status='tripped';

  return jsonb_build_object(
    'constitution_version','autopilot-v1-existing-primitives',
    'runtime',jsonb_build_object(
      'execution_enabled',coalesce(ec.runtime_execution_enabled,false),
      'autonomy_level',coalesce(ec.runtime_autonomy_level,0),
      'max_risk',coalesce(ec.runtime_max_risk,0),
      'heartbeat_enabled',coalesce(ec.heartbeat_enabled,false),
      'factory_enabled',coalesce(ec.factory_enabled,false),
      'shadow_enabled',coalesce(ec.shadow_enabled,false),
      'shadow_scheduler_enabled',coalesce(ec.shadow_scheduler_enabled,false),
      'global_stop',coalesce(ec.shadow_global_stop,true),
      'anomaly_paused',coalesce(ec.runtime_anomaly_paused,false)
    ),
    'global_policy',coalesce(v_global_policy,'{}'::jsonb),
    'active_capability_authority',v_active_authority,
    'tripped_breakers',v_tripped_breakers,
    'authority_principle','owner_policy_intersection_not_worker_identity',
    'worker_names_are_authority',false
  );
end $$;

create or replace function public.hq_autopilot_founder_brief()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  v_total bigint:=0;
  v_completed bigint:=0;
  v_verified bigint:=0;
  v_attention bigint:=0;
  v_dead bigint:=0;
  v_findings bigint:=0;
  v_decisions bigint:=0;
  v_retries bigint:=0;
  v_verifications bigint:=0;
  v_constitution jsonb;
begin
  perform public.hq_assert_owner();
  select count(*),
         count(*) filter(where status='completed'),
         count(*) filter(where status='completed' and verification_status='verified'),
         count(*) filter(where status in ('failed','dead_letter') or verification_status='failed' or (status='running' and lease_expires_at<clock_timestamp()))
    into v_total,v_completed,v_verified,v_attention
    from public.hq_workforce_task_contracts;
  select count(*) into v_dead from public.hq_workforce_dead_letters;
  select count(*) into v_findings from public.hq_findings;
  select count(*) into v_decisions from public.hq_decisions;
  select coalesce(sum(greatest(attempt_count-1,0)),0) into v_retries from public.hq_workforce_task_contracts;
  select count(*) into v_verifications from public.hq_workforce_execution_verifications;
  v_constitution:=public.hq_autopilot_constitution_snapshot();

  return jsonb_build_object(
    'read_model_version','autopilot-founder-brief-v1',
    'generated_at',clock_timestamp(),
    'operations',jsonb_build_object(
      'total_tasks',v_total,
      'completed',v_completed,
      'independently_verified',v_verified,
      'verification_records',v_verifications,
      'retries_observed',v_retries,
      'dead_letters',v_dead,
      'attention_required',v_attention
    ),
    'founder',jsonb_build_object('findings',v_findings,'decisions',v_decisions),
    'constitution',v_constitution,
    'truth_note','Counts are derived from canonical ledgers; no inferred success is reported as verified success.'
  );
end $$;

revoke all on function public.hq_autopilot_constitution_snapshot() from public,anon,service_role;
revoke all on function public.hq_autopilot_founder_brief() from public,anon,service_role;
grant execute on function public.hq_autopilot_constitution_snapshot() to authenticated;
grant execute on function public.hq_autopilot_founder_brief() to authenticated;

comment on function public.hq_autopilot_constitution_snapshot() is
'Owner-only Autopilot Constitution read model composed from existing runtime policy, authority and breaker truth. Never grants authority.';
comment on function public.hq_autopilot_founder_brief() is
'Owner-only truthful Autopilot company-state summary. Verified success is never inferred from completion alone.';

-- Installation must preserve the existing fail-closed production-safe posture.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_requires_engine_contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'autopilot_read_model_changed_fail_closed_posture';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'autopilot_read_model_activated_authority'; end if;
end $$;
