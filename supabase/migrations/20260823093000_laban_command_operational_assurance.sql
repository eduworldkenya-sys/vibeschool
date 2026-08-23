-- Laban Operational Assurance v1 — NON-ACTIVATING.
-- Provides war-room observability, post-mission learning and executable architecture-invariant checks.

create or replace function public.hq_workforce_command_war_room_snapshot(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  m public.hq_workforce_command_missions%rowtype;
  delegations jsonb;
  challenges jsonb;
  hypotheses jsonb;
  risks jsonb;
  approvals jsonb;
  assurance jsonb;
  failover jsonb;
  learning jsonb;
begin
  select * into m from public.hq_workforce_command_missions where id=p_mission_id;
  if not found then raise exception 'command_mission_not_found'; end if;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at),'[]'::jsonb) into delegations
    from public.hq_workforce_command_delegations d where d.mission_id=p_mission_id;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into challenges
    from public.hq_workforce_command_challenges c where c.mission_id=p_mission_id;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at),'[]'::jsonb) into hypotheses
    from public.hq_workforce_command_hypotheses h where h.mission_id=p_mission_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into risks
    from public.hq_workforce_command_risk_allocations r where r.mission_id=p_mission_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb) into approvals
    from public.hq_workforce_command_two_key_approvals a where a.mission_id=p_mission_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb) into assurance
    from public.hq_workforce_command_assurance_assignments a where a.mission_id=p_mission_id;
  select coalesce(to_jsonb(f),'{}'::jsonb) into failover
    from public.hq_workforce_command_failover f where f.mission_id=p_mission_id;
  failover:=coalesce(failover,'{}'::jsonb);
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb) into learning
    from public.hq_workforce_command_learning_cases l where l.mission_id=p_mission_id;

  return jsonb_build_object(
    'mission',to_jsonb(m),
    'delegations',delegations,
    'open_blockers',(select count(*) from public.hq_workforce_command_challenges c where c.mission_id=p_mission_id and c.status='open' and c.severity in ('blocking','critical')),
    'challenges',challenges,
    'hypotheses',hypotheses,
    'risk_allocations',risks,
    'two_key_approvals',approvals,
    'assurance_assignments',assurance,
    'failover',failover,
    'learning_cases',learning
  );
end $$;

create or replace function public.hq_workforce_command_record_learning_case(
  p_mission_id uuid,
  p_created_by text,
  p_category text,
  p_trigger_event text,
  p_root_cause jsonb,
  p_invariant_added text,
  p_regression_test_ref text,
  p_evidence_hash text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare m public.hq_workforce_command_missions%rowtype; v_id uuid;
begin
  select * into m from public.hq_workforce_command_missions where id=p_mission_id for update;
  if not found then raise exception 'command_mission_not_found'; end if;
  if m.state not in ('complete','failed_safe','stopped') then raise exception 'learning_requires_terminal_mission'; end if;
  if char_length(btrim(coalesce(p_created_by,'')))<1 then raise exception 'learning_actor_required'; end if;
  if char_length(btrim(coalesce(p_category,'')))<3 then raise exception 'learning_category_required'; end if;
  if char_length(btrim(coalesce(p_trigger_event,'')))<3 then raise exception 'learning_trigger_required'; end if;
  if coalesce(jsonb_typeof(p_root_cause),'null')<>'object' or p_root_cause='{}'::jsonb then raise exception 'learning_root_cause_required'; end if;
  if char_length(btrim(coalesce(p_regression_test_ref,'')))<3 then raise exception 'learning_regression_test_required'; end if;
  if char_length(btrim(coalesce(p_evidence_hash,'')))<8 then raise exception 'learning_evidence_hash_required'; end if;

  insert into public.hq_workforce_command_learning_cases(
    mission_id,category,trigger_event,root_cause,invariant_added,regression_test_ref,evidence_hash,created_by
  ) values(
    p_mission_id,btrim(p_category),btrim(p_trigger_event),p_root_cause,nullif(btrim(coalesce(p_invariant_added,'')),''),btrim(p_regression_test_ref),btrim(p_evidence_hash),p_created_by
  ) returning id into v_id;

  perform public.hq_workforce_command_append_event(p_mission_id,p_created_by,'learning.recorded',jsonb_build_object('learning_case_id',v_id,'regression_test_ref',p_regression_test_ref));
  return v_id;
end $$;

create or replace function public.hq_workforce_command_assert_architecture_invariants()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare legacy_def text; canonical_def text; enabled_count integer;
begin
  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into legacy_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into canonical_def;

  if position('hq_workforce_consequential_execution_gateway' in legacy_def)=0 then
    raise exception 'architecture_drift_legacy_gateway_not_bridged';
  end if;
  if position('update public.hq_work_items' in lower(legacy_def))>0 then
    raise exception 'architecture_drift_second_consequential_gateway';
  end if;
  if position('hq_workforce_assert_consequential_task_authorized' in canonical_def)=0 then
    raise exception 'architecture_drift_canonical_authorization_missing';
  end if;
  select count(*) into enabled_count from public.hq_workforce_architecture_invariants
    where enabled and invariant_key in ('single_consequential_gateway','no_self_authority','no_self_certification','scheduler_no_authority','contradiction_reopens');
  if enabled_count<>5 then raise exception 'architecture_invariants_not_fully_enabled:%',enabled_count; end if;

  return jsonb_build_object('decision','pass','enabled_invariants',enabled_count,'legacy_gateway','bridged','canonical_authorization','present');
end $$;

revoke all on function public.hq_workforce_command_war_room_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_command_record_learning_case(uuid,text,text,text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_command_assert_architecture_invariants() from public,anon,authenticated;
grant execute on function public.hq_workforce_command_war_room_snapshot(uuid) to service_role;
grant execute on function public.hq_workforce_command_record_learning_case(uuid,text,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.hq_workforce_command_assert_architecture_invariants() to service_role;

-- Reassert non-activation after operational assurance surfaces are installed.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; v_active integer; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'command_operational_assurance_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'command_operational_assurance_non_activating_boundary_violated';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'command_operational_assurance_must_not_activate_authority'; end if;
end $$;
