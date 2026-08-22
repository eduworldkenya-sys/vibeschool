-- Non-activating Worker Engine backend governance reconciliation.
-- Restores repository/runtime parity for capability runtime ceilings and closes the
-- legacy service-role shadow approval path. Does not enable runtime, shadow, factory,
-- heartbeat, autonomy, publishing, payments, or capability authority.

alter table public.hq_workforce_capability_authority_grants
  add column if not exists max_runtime_ms integer not null default 30000;

alter table public.hq_workforce_capability_authority_grants
  drop constraint if exists hq_workforce_capability_authority_grants_max_runtime_ms_check;

alter table public.hq_workforce_capability_authority_grants
  add constraint hq_workforce_capability_authority_grants_max_runtime_ms_check
  check (max_runtime_ms between 50 and 600000);

create or replace function public.hq_workforce_shadow_review_decision(
  p_decision_id uuid,
  p_state text,
  p_rationale text default null
) returns public.hq_workforce_shadow_decisions
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare d public.hq_workforce_shadow_decisions%rowtype;
begin
  if p_state not in ('rejected','revise') then
    raise exception 'owner_review_required_for_shadow_approval' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_rationale,'')))<3 then
    raise exception 'review_rationale_required';
  end if;
  update public.hq_workforce_shadow_decisions
     set state=p_state,
         human_rationale=btrim(p_rationale),
         reviewed_by=auth.uid(),
         reviewed_at=clock_timestamp(),
         updated_at=clock_timestamp()
   where id=p_decision_id and state in ('proposed','awaiting_review')
   returning * into d;
  if not found then raise exception 'decision_not_reviewable'; end if;
  return d;
end $$;

revoke all on function public.hq_workforce_shadow_review_decision(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_review_decision(uuid,text,text) to service_role;

create or replace function public.hq_workforce_owner_review_shadow_decision(
  p_decision_id uuid,
  p_state text,
  p_rationale text default null
) returns public.hq_workforce_shadow_decisions
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  d public.hq_workforce_shadow_decisions%rowtype;
  tr public.hq_workforce_shadow_traces%rowtype;
begin
  if not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  if p_state not in ('approved','rejected','revise') then raise exception 'invalid_review_state'; end if;
  if char_length(btrim(coalesce(p_rationale,'')))<3 then raise exception 'review_rationale_required'; end if;

  select * into d from public.hq_workforce_shadow_decisions where id=p_decision_id for update;
  if not found then raise exception 'decision_not_found'; end if;
  if d.state not in ('proposed','awaiting_review') then raise exception 'decision_not_reviewable'; end if;

  select * into tr from public.hq_workforce_shadow_traces where trace_id=d.trace_id for update;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  if tr.status<>'awaiting_review' then raise exception 'shadow_trace_not_reviewable'; end if;

  if p_state='approved' then
    if d.hypothetical_authority_result<>'allow' then
      raise exception 'shadow_approval_requires_authority_allow';
    end if;
    if coalesce(tr.consequential_action_performed,false) then
      raise exception 'shadow_approval_requires_no_consequential_execution';
    end if;
    if not exists (
      select 1 from public.hq_workforce_shadow_candidates c
      where c.trace_id=d.trace_id and c.status='recommended' and c.worker_key=tr.worker_key
    ) then
      raise exception 'shadow_approval_requires_recommended_candidate_lineage';
    end if;
    if exists (
      select 1 from public.hq_workforce_shadow_anomalies a
      where a.trace_id=d.trace_id and a.resolved_at is null
    ) then
      raise exception 'shadow_approval_blocked_by_unresolved_anomaly';
    end if;
    if not exists (
      select 1 from public.hq_workforce_shadow_events e
      where e.trace_id=d.trace_id
        and e.event_kind='authority_result'
        and e.payload->>'decision'='allow'
    ) then
      raise exception 'shadow_approval_requires_recorded_authority_allow';
    end if;
  end if;

  update public.hq_workforce_shadow_decisions
     set state=p_state,
         human_rationale=btrim(p_rationale),
         reviewed_by=auth.uid(),
         reviewed_at=clock_timestamp(),
         updated_at=clock_timestamp()
   where id=d.id
   returning * into d;
  return d;
end $$;

revoke all on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text) to authenticated;

-- Fail if this reconciliation ever attempts to activate the engine or authority.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'worker_engine_contract_missing'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'backend_governance_reconciliation_requires_engine_fully_stopped';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'backend_governance_reconciliation_cannot_run_with_active_authority'; end if;
end $$;
