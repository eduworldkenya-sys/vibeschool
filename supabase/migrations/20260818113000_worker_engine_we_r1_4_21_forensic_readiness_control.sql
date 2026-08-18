-- WE-R1.4.21: canonical execution dossier, telemetry completeness and readiness control.
-- NON-ACTIVATING. This migration adds read/diagnostic contracts only. It does not enable
-- runtime, heartbeat, Factory, Shadow, autonomy, risk authority, capability authority or cron.
-- access: service-read public.hq_workforce_execution_telemetry_completeness
-- access: owner-only public.hq_workforce_get_execution_dossier
-- access: owner-only public.hq_workforce_list_execution_attention
-- access: service-read public.hq_workforce_production_readiness_scorecard

create or replace function public.hq_workforce_execution_telemetry_completeness(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  v_plan_bound boolean:=false;
  v_intent_exists boolean:=false;
  v_intent_committed boolean:=false;
  v_execution_evidence boolean:=false;
  v_verifier_assigned boolean:=false;
  v_verifier_consumed boolean:=false;
  v_verification_exists boolean:=false;
  v_verification_passed boolean:=false;
  v_breaker_blocked boolean:=false;
  v_dead_letter boolean:=false;
  v_terminal boolean:=false;
  v_complete boolean:=false;
  v_mode text:='in_progress';
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then
    return jsonb_build_object('task_id',p_task_id,'complete',false,'mode','missing','reason','task_not_found');
  end if;

  select exists(
    select 1
      from public.hq_workforce_plan_steps ps
      join public.hq_workforce_plans p on p.id=ps.plan_id
      join public.hq_workforce_objectives o on o.id=p.objective_id
     where ps.id=t.plan_step_id
       and o.status='approved'
       and o.approved_plan_id=p.id
       and o.approved_plan_hash is not null
       and o.approved_plan_hash=public.hq_workforce_plan_authority_hash(p.id)
  ) into v_plan_bound;

  select exists(select 1 from public.hq_workforce_execution_intents i where i.task_id=t.id),
         exists(select 1 from public.hq_workforce_execution_intents i where i.task_id=t.id and i.status='committed')
    into v_intent_exists,v_intent_committed;

  v_execution_evidence:=coalesce(t.execution_evidence,'{}'::jsonb)<>'{}'::jsonb;

  select exists(select 1 from public.hq_workforce_verifier_assignments a where a.execution_task_id=t.id),
         exists(select 1 from public.hq_workforce_verifier_assignments a where a.execution_task_id=t.id and a.status='consumed')
    into v_verifier_assigned,v_verifier_consumed;

  select exists(select 1 from public.hq_workforce_execution_verifications v where v.task_id=t.id),
         exists(select 1 from public.hq_workforce_execution_verifications v where v.task_id=t.id and v.passed)
    into v_verification_exists,v_verification_passed;

  select exists(
    select 1 from public.hq_workforce_execution_breaker_events e
     where e.task_id=t.id and e.event_kind='execution_blocked'
       and coalesce((e.evidence->>'mutation_performed')::boolean,false)=false
  ) into v_breaker_blocked;

  select exists(select 1 from public.hq_workforce_dead_letters d where d.task_id=t.id) into v_dead_letter;

  v_terminal:=t.status in ('completed','failed','dead_letter');

  if t.status='completed' then
    v_mode:='consequential_success';
    v_complete:=v_plan_bound
      and t.autonomous_authority_grant_id is not null
      and t.capability_version is not null
      and v_intent_exists and v_intent_committed
      and v_execution_evidence
      and v_verifier_assigned and v_verifier_consumed
      and v_verification_exists and v_verification_passed
      and t.verification_status='verified';
  elsif t.status='failed' and coalesce(t.execution_evidence->>'decision','')='deny'
        and coalesce(t.execution_evidence->>'reason','')='circuit_breaker' then
    v_mode:='breaker_denial';
    v_complete:=v_execution_evidence and v_breaker_blocked;
  elsif t.status='dead_letter' then
    v_mode:='dead_letter';
    v_complete:=v_dead_letter and nullif(btrim(coalesce(t.last_error,'')),'') is not null;
  elsif t.status='failed' then
    v_mode:='failed';
    v_complete:=v_execution_evidence and nullif(btrim(coalesce(t.last_error,'')),'') is not null;
  end if;

  return jsonb_build_object(
    'task_id',t.id,
    'task_key',t.task_key,
    'status',t.status,
    'verification_status',t.verification_status,
    'mode',v_mode,
    'terminal',v_terminal,
    'complete',v_complete,
    'checks',jsonb_build_object(
      'approved_plan_binding',v_plan_bound,
      'authority_bound',t.autonomous_authority_grant_id is not null,
      'capability_version_bound',t.capability_version is not null,
      'execution_intent_exists',v_intent_exists,
      'execution_intent_committed',v_intent_committed,
      'execution_evidence_present',v_execution_evidence,
      'verifier_assignment_exists',v_verifier_assigned,
      'verifier_assignment_consumed',v_verifier_consumed,
      'verification_exists',v_verification_exists,
      'verification_passed',v_verification_passed,
      'durable_breaker_block_evidence',v_breaker_blocked,
      'dead_letter_evidence',v_dead_letter
    )
  );
end $$;

create or replace function public.hq_workforce_get_execution_dossier(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  v_lineage jsonb:='{}'::jsonb;
  v_authority jsonb:='{}'::jsonb;
  v_intent jsonb:='{}'::jsonb;
  v_verification jsonb:='{}'::jsonb;
  v_verifier jsonb:='{}'::jsonb;
  v_breakers jsonb:='[]'::jsonb;
  v_dead_letter jsonb:='{}'::jsonb;
  v_completeness jsonb;
begin
  perform public.hq_assert_owner();
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'worker_execution_dossier_task_not_found'; end if;

  select jsonb_build_object('plan_step',to_jsonb(ps),'plan',to_jsonb(p),'objective',to_jsonb(o))
    into v_lineage
    from public.hq_workforce_plan_steps ps
    join public.hq_workforce_plans p on p.id=ps.plan_id
    join public.hq_workforce_objectives o on o.id=p.objective_id
   where ps.id=t.plan_step_id;
  v_lineage:=coalesce(v_lineage,'{}'::jsonb);

  select to_jsonb(g) into v_authority
    from public.hq_workforce_capability_authority_grants g where g.id=t.autonomous_authority_grant_id;
  v_authority:=coalesce(v_authority,'{}'::jsonb);

  select to_jsonb(i) into v_intent from public.hq_workforce_execution_intents i where i.task_id=t.id;
  v_intent:=coalesce(v_intent,'{}'::jsonb);

  select to_jsonb(v) into v_verification from public.hq_workforce_execution_verifications v where v.task_id=t.id;
  v_verification:=coalesce(v_verification,'{}'::jsonb);

  select to_jsonb(a) into v_verifier from public.hq_workforce_verifier_assignments a where a.execution_task_id=t.id;
  v_verifier:=coalesce(v_verifier,'{}'::jsonb);

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb)
    into v_breakers from public.hq_workforce_execution_breaker_events e where e.task_id=t.id;

  select to_jsonb(d) into v_dead_letter from public.hq_workforce_dead_letters d where d.task_id=t.id;
  v_dead_letter:=coalesce(v_dead_letter,'{}'::jsonb);

  v_completeness:=public.hq_workforce_execution_telemetry_completeness(t.id);

  return jsonb_build_object(
    'dossier_version','WE-R1.4.21',
    'task_id',t.id,
    'correlation_identity',t.id,
    'task',to_jsonb(t),
    'objective_plan_lineage',v_lineage,
    'authority',v_authority,
    'execution_intent',v_intent,
    'verifier_assignment',v_verifier,
    'verification',v_verification,
    'breaker_events',v_breakers,
    'dead_letter',v_dead_letter,
    'telemetry_completeness',v_completeness
  );
end $$;

create or replace function public.hq_workforce_list_execution_attention(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare v_rows jsonb;
begin
  perform public.hq_assert_owner();
  if p_limit<1 or p_limit>200 then raise exception 'worker_attention_limit_invalid'; end if;

  select coalesce(jsonb_agg(x.item order by x.severity_rank,x.created_at desc),'[]'::jsonb)
    into v_rows
    from (
      select case
               when t.status='completed' and not coalesce((c.payload->>'complete')::boolean,false) then 1
               when t.verification_status='failed' then 1
               when t.status='failed' then 2
               when t.status='dead_letter' then 2
               when t.status='running' and t.lease_expires_at<clock_timestamp() then 2
               else 3
             end severity_rank,
             t.created_at,
             jsonb_build_object(
               'severity',case
                 when t.status='completed' and not coalesce((c.payload->>'complete')::boolean,false) then 'P0'
                 when t.verification_status='failed' then 'P0'
                 when t.status in ('failed','dead_letter') then 'P1'
                 when t.status='running' and t.lease_expires_at<clock_timestamp() then 'P1'
                 else 'P2' end,
               'task_id',t.id,'task_key',t.task_key,'status',t.status,
               'verification_status',t.verification_status,'last_error',t.last_error,
               'completeness',c.payload
             ) item
        from public.hq_workforce_task_contracts t
        cross join lateral (select public.hq_workforce_execution_telemetry_completeness(t.id) payload) c
       where (t.status='completed' and not coalesce((c.payload->>'complete')::boolean,false))
          or t.verification_status='failed'
          or t.status in ('failed','dead_letter')
          or (t.status='running' and t.lease_expires_at<clock_timestamp())
       order by severity_rank,t.created_at desc
       limit p_limit
    ) x;
  return jsonb_build_object('generated_at',clock_timestamp(),'items',v_rows);
end $$;

create or replace function public.hq_workforce_production_readiness_scorecard()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_fail_closed boolean:=false;
  v_no_active_authority boolean:=false;
  v_authority_plane_closed boolean:=false;
  v_canonical_gateway boolean:=false;
  v_breaker_history boolean:=false;
  v_verifier_binding boolean:=false;
  v_forensics boolean:=false;
  v_ready boolean:=false;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  v_fail_closed:=found
    and not coalesce(ec.heartbeat_enabled,false)
    and not coalesce(ec.factory_enabled,false)
    and not coalesce(ec.runtime_execution_enabled,false)
    and coalesce(ec.runtime_autonomy_level,0)=0
    and coalesce(ec.runtime_max_risk,0)=0
    and not coalesce(ec.shadow_enabled,false)
    and not coalesce(ec.shadow_scheduler_enabled,false)
    and coalesce(ec.shadow_global_stop,true);

  select count(*)=0 into v_no_active_authority
    from public.hq_workforce_capability_authority_grants where status='active';

  v_authority_plane_closed:=
    not has_table_privilege('service_role','public.hq_workforce_engine_contract','UPDATE')
    and not has_table_privilege('service_role','public.hq_workforce_runtime_policies','UPDATE')
    and not has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','UPDATE')
    and not has_table_privilege('service_role','public.hq_workforce_objectives','UPDATE')
    and not has_table_privilege('service_role','public.hq_workforce_plans','UPDATE');

  v_canonical_gateway:=
    to_regprocedure('public.hq_workforce_tool_gateway_execute(uuid)') is not null
    and to_regprocedure('public.hq_workforce_consequential_execution_gateway(uuid)') is not null
    and to_regprocedure('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)') is not null
    and not has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE');

  v_breaker_history:=
    to_regclass('public.hq_workforce_execution_breakers') is not null
    and to_regclass('public.hq_workforce_execution_breaker_events') is not null
    and exists(select 1 from pg_trigger where tgrelid='public.hq_workforce_execution_breaker_events'::regclass and tgname='trg_hq_workforce_execution_breaker_event_immutable' and not tgisinternal);

  v_verifier_binding:=
    to_regclass('public.hq_workforce_verifier_assignments') is not null
    and to_regprocedure('public.hq_workforce_assign_independent_verifier(uuid,uuid)') is not null
    and to_regprocedure('public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)') is not null
    and not has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE');

  v_forensics:=
    to_regprocedure('public.hq_workforce_execution_telemetry_completeness(uuid)') is not null
    and to_regprocedure('public.hq_workforce_get_execution_dossier(uuid)') is not null
    and to_regprocedure('public.hq_workforce_list_execution_attention(integer)') is not null;

  v_ready:=v_fail_closed and v_no_active_authority and v_authority_plane_closed
           and v_canonical_gateway and v_breaker_history and v_verifier_binding and v_forensics;

  return jsonb_build_object(
    'scorecard_version','WE-R1.4.21',
    'schema_ready_for_controlled_canary',v_ready,
    'production_runtime_activated',coalesce(ec.runtime_execution_enabled,false),
    'checks',jsonb_build_object(
      'fail_closed_engine',v_fail_closed,
      'zero_active_capability_authority',v_no_active_authority,
      'authority_plane_direct_write_closed',v_authority_plane_closed,
      'single_canonical_gateway',v_canonical_gateway,
      'durable_breaker_history',v_breaker_history,
      'bound_independent_verifier',v_verifier_binding,
      'canonical_forensic_read_model',v_forensics
    ),
    'activation_note','Certification is not activation. Production promotion and canary activation remain separately governed.'
  );
end $$;

revoke all on function public.hq_workforce_execution_telemetry_completeness(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_execution_telemetry_completeness(uuid) to service_role;
revoke all on function public.hq_workforce_get_execution_dossier(uuid) from public,anon,service_role;
grant execute on function public.hq_workforce_get_execution_dossier(uuid) to authenticated;
revoke all on function public.hq_workforce_list_execution_attention(integer) from public,anon,service_role;
grant execute on function public.hq_workforce_list_execution_attention(integer) to authenticated;
revoke all on function public.hq_workforce_production_readiness_scorecard() from public,anon,authenticated;
grant execute on function public.hq_workforce_production_readiness_scorecard() to service_role;

comment on function public.hq_workforce_get_execution_dossier(uuid) is
'Owner-only canonical forensic read model for one consequential task identity. Read-only; grants no mutation authority.';
comment on function public.hq_workforce_production_readiness_scorecard() is
'Machine-readable fail-closed schema readiness verdict. A green verdict never activates runtime or capability authority.';

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
  v_score jsonb;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.21 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.21 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.21 cannot install with active capability authority'; end if;
  v_score:=public.hq_workforce_production_readiness_scorecard();
  if not coalesce((v_score->>'schema_ready_for_controlled_canary')::boolean,false) then
    raise exception 'WE-R1.4.21 readiness scorecard failed:%',v_score;
  end if;
end $$;
