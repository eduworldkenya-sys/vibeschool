-- WE-R1.4.5: bounded compare-and-compensate recovery.
-- NON-ACTIVATING. This gate adds recovery evidence and a governed compensation path only.
-- It does not enable runtime, heartbeat, Factory, Shadow, autonomy, risk authority,
-- or capability-authority activation.
-- access: service-only public.hq_workforce_execution_compensations
-- authorization-test: compensation evidence denies public/anon/authenticated direct access and service_role is read-only.

alter table public.hq_workforce_execution_intents
  add column if not exists authoritative_before_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(authoritative_before_state)='object'),
  add column if not exists expected_after_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(expected_after_state)='object');

create table if not exists public.hq_workforce_execution_compensations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.hq_workforce_execution_intents(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  requested_by text not null check (char_length(btrim(requested_by)) between 3 and 240),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  before_state jsonb not null check (jsonb_typeof(before_state)='object' and before_state<>'{}'::jsonb),
  expected_current_state jsonb not null check (jsonb_typeof(expected_current_state)='object' and expected_current_state<>'{}'::jsonb),
  observed_current_state jsonb not null check (jsonb_typeof(observed_current_state)='object'),
  outcome text not null check (outcome in ('compensated','conflict_escalated','denied')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp()
);

create unique index if not exists hq_workforce_execution_compensations_one_success_idx
  on public.hq_workforce_execution_compensations(intent_id)
  where outcome='compensated';
create index if not exists hq_workforce_execution_compensations_outcome_idx
  on public.hq_workforce_execution_compensations(outcome,created_at desc);

alter table public.hq_workforce_execution_compensations enable row level security;
revoke all on table public.hq_workforce_execution_compensations from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_compensations to service_role;

create or replace function public.hq_workforce_guard_execution_compensation_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'execution_compensation_immutable';
end $$;

drop trigger if exists trg_hq_workforce_execution_compensation_immutable on public.hq_workforce_execution_compensations;
create trigger trg_hq_workforce_execution_compensation_immutable
before update or delete on public.hq_workforce_execution_compensations
for each row execute function public.hq_workforce_guard_execution_compensation_immutable();

-- Replace the R1.4 gateway so the authoritative recovery snapshot is captured from the
-- locked database row immediately before mutation. Caller-supplied preconditions remain
-- useful for stale-state rejection but are never trusted as compensation truth.
create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  wi public.hq_work_items%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
  v_before jsonb;
  v_after jsonb;
  result jsonb;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_authority_id:=nullif(auth->>'authority_grant_id','')::uuid;
  if v_authority_id is null then raise exception 'consequential_authority_evidence_missing'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;

  if tc.handler_key='work_item.triage_and_own' then
    work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
    if work_item_id is null then raise exception 'work_item_id_required'; end if;
    v_resource_identity:=jsonb_build_object('work_item_id',work_item_id);
    v_precondition:=t.payload->'precondition_snapshot';
    v_desired:=t.payload->'desired_state';
    if coalesce(jsonb_typeof(v_precondition),'null')<>'object' then raise exception 'precondition_snapshot_required'; end if;
    if coalesce(jsonb_typeof(v_desired),'null')<>'object' then raise exception 'desired_state_required'; end if;
    if not (v_precondition ? 'status' and v_precondition ? 'updated_at') then raise exception 'work_item_precondition_incomplete'; end if;
    if v_desired->>'status' is distinct from 'in_progress' then raise exception 'work_item_desired_state_denied'; end if;
  else
    raise exception 'tool_handler_not_allowlisted';
  end if;

  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then
    return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id);
  end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;
    if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
    if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
    if wi.status<>'open' then raise exception 'work_item_not_open'; end if;

    v_before:=jsonb_build_object(
      'status',wi.status,
      'action_taken',coalesce(wi.action_taken,'null'::jsonb),
      'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end
    );
    v_after:=jsonb_build_object(
      'status','in_progress',
      'task_id',t.id::text,
      'authority_grant_id',v_authority_id::text,
      'plan_step_id',t.plan_step_id::text,
      'execution_intent_id',v_intent_id::text
    );

    update public.hq_workforce_execution_intents
       set authoritative_before_state=v_before,
           expected_after_state=v_after
     where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;

    update public.hq_work_items
       set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
             'worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,
             'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),
           acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress'
     where id=work_item_id;

    result:=jsonb_build_object(
      'handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
      'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,
      'side_effect','hq_work_items.updated','authorization',auth,'idempotent_replay',false);
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    perform public.hq_workforce_commit_execution_intent(v_intent_id,result);
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

create or replace function public.hq_workforce_compensate_consequential_execution(
  p_task_id uuid,
  p_requested_by text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  v_work_item_id uuid;
  v_observed jsonb;
  v_comp_id uuid;
  v_before_action jsonb;
  v_before_acted_at timestamptz;
begin
  if char_length(btrim(coalesce(p_requested_by,'')))<3 then raise exception 'compensation_requester_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'compensation_reason_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'compensation_task_not_found'; end if;
  if t.verification_status<>'failed' then raise exception 'compensation_requires_failed_verification'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'compensation_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'compensation_execution_intent_not_committed'; end if;
  if i.verification_status<>'failed' then raise exception 'compensation_requires_failed_intent_verification'; end if;
  if i.authoritative_before_state='{}'::jsonb or i.expected_after_state='{}'::jsonb then raise exception 'compensation_recovery_snapshot_missing'; end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'compensation_authority_missing'; end if;
  if not g.compensation_required then raise exception 'compensation_not_required_by_authority'; end if;
  if char_length(btrim(coalesce(g.compensation_strategy,'')))<3 then raise exception 'compensation_strategy_missing'; end if;

  if t.resource_type<>'hq_work_items' or t.operation<>'update' then raise exception 'unsupported_consequential_compensation_contract'; end if;
  v_work_item_id:=nullif(i.resource_identity->>'work_item_id','')::uuid;
  if v_work_item_id is null then raise exception 'compensation_resource_identity_missing'; end if;

  select * into wi from public.hq_work_items where id=v_work_item_id for update;
  if not found then
    v_observed:=jsonb_build_object('resource_exists',false);
    insert into public.hq_workforce_execution_compensations(
      intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
    ) values(
      i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
      'conflict_escalated',jsonb_build_object('cause','resource_missing','mutation_applied',false)
    ) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;

  v_observed:=jsonb_build_object(
    'status',wi.status,
    'task_id',wi.action_taken->>'task_id',
    'authority_grant_id',wi.action_taken->>'authority_grant_id',
    'plan_step_id',wi.action_taken->>'plan_step_id',
    'execution_intent_id',wi.action_taken->>'execution_intent_id'
  );

  -- Compare-and-compensate: never overwrite a newer human/process decision.
  if v_observed is distinct from i.expected_after_state then
    insert into public.hq_workforce_execution_compensations(
      intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
    ) values(
      i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
      'conflict_escalated',jsonb_build_object('cause','current_state_diverged','mutation_applied',false)
    ) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;

  v_before_action:=case
    when i.authoritative_before_state->'action_taken'='null'::jsonb then null
    else i.authoritative_before_state->'action_taken'
  end;
  v_before_acted_at:=nullif(i.authoritative_before_state->>'acted_at','')::timestamptz;

  update public.hq_work_items
     set status=i.authoritative_before_state->>'status',
         action_taken=v_before_action,
         acted_at=v_before_acted_at,
         updated_at=clock_timestamp()
   where id=v_work_item_id;

  update public.hq_workforce_execution_intents
     set status='compensated',compensated_at=clock_timestamp()
   where id=i.id and status='committed';
  if not found then raise exception 'compensation_intent_transition_failed'; end if;

  insert into public.hq_workforce_execution_compensations(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence
  ) values(
    i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,
    'compensated',jsonb_build_object('mutation_applied',true,'resource_type',t.resource_type,'resource_identity',i.resource_identity)
  ) returning id into v_comp_id;

  return jsonb_build_object('compensation_id',v_comp_id,'outcome','compensated','mutation_applied',true);
end $$;

revoke all on function public.hq_workforce_guard_execution_compensation_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_guard_execution_compensation_immutable() to service_role;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
grant execute on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) to service_role;

-- Gate invariant: recovery engineering cannot activate execution authority.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.5 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.5 violated fail-closed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.5 cannot activate capability authority'; end if;
end $$;
