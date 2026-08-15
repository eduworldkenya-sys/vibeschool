-- WE-R1.4.8: deterministic circuit breakers + operator stops.
-- NON-ACTIVATING. Breakers are prohibitions only. Resetting a breaker removes a
-- prohibition; it never grants authority, changes budgets/limits/risk, or enables runtime.
-- access: service-only public.hq_workforce_execution_breakers
-- authorization-test: public.hq_workforce_execution_breakers
-- access: service-only public.hq_workforce_execution_breaker_events
-- authorization-test: public.hq_workforce_execution_breaker_events

create table if not exists public.hq_workforce_execution_breakers (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global','capability','authority_grant')),
  scope_ref text not null check (char_length(btrim(scope_ref)) between 1 and 240),
  status text not null default 'tripped' check (status in ('tripped','reset')),
  reason_code text not null check (char_length(btrim(reason_code)) between 3 and 240),
  tripped_by text not null check (char_length(btrim(tripped_by)) between 3 and 240),
  tripped_at timestamptz not null default clock_timestamp(),
  reset_by text,
  reset_reason text,
  reset_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status='tripped' and reset_by is null and reset_reason is null and reset_at is null)
    or
    (status='reset' and char_length(btrim(reset_by)) between 3 and 240
      and char_length(btrim(reset_reason)) between 3 and 240 and reset_at is not null)
  ),
  check ((scope_type='global' and scope_ref='global') or scope_type<>'global')
);

create unique index if not exists hq_workforce_execution_breakers_active_scope_idx
  on public.hq_workforce_execution_breakers(scope_type,scope_ref)
  where status='tripped';
create index if not exists hq_workforce_execution_breakers_scope_history_idx
  on public.hq_workforce_execution_breakers(scope_type,scope_ref,created_at desc);

create table if not exists public.hq_workforce_execution_breaker_events (
  id bigint generated always as identity primary key,
  breaker_id uuid not null references public.hq_workforce_execution_breakers(id) on delete restrict,
  event_kind text not null check (event_kind in ('tripped','reset','execution_blocked')),
  task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  capability_key text,
  actor text not null check (char_length(btrim(actor)) between 3 and 240),
  reason_code text not null check (char_length(btrim(reason_code)) between 3 and 240),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists hq_workforce_execution_breaker_events_breaker_idx
  on public.hq_workforce_execution_breaker_events(breaker_id,created_at desc);
create index if not exists hq_workforce_execution_breaker_events_task_idx
  on public.hq_workforce_execution_breaker_events(task_id,created_at desc)
  where task_id is not null;

alter table public.hq_workforce_execution_breakers enable row level security;
alter table public.hq_workforce_execution_breaker_events enable row level security;
revoke all on table public.hq_workforce_execution_breakers from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_execution_breaker_events from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_breakers to service_role;
grant select on table public.hq_workforce_execution_breaker_events to service_role;

-- Event evidence is immutable. Breaker rows may transition exactly once: tripped -> reset.
create or replace function public.hq_workforce_guard_execution_breaker_event_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'execution_breaker_event_immutable';
end $$;

drop trigger if exists trg_hq_workforce_execution_breaker_event_immutable on public.hq_workforce_execution_breaker_events;
create trigger trg_hq_workforce_execution_breaker_event_immutable
before update or delete on public.hq_workforce_execution_breaker_events
for each row execute function public.hq_workforce_guard_execution_breaker_event_immutable();

create or replace function public.hq_workforce_guard_execution_breaker_transition()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'execution_breaker_delete_denied'; end if;
  if old.scope_type is distinct from new.scope_type
     or old.scope_ref is distinct from new.scope_ref
     or old.reason_code is distinct from new.reason_code
     or old.tripped_by is distinct from new.tripped_by
     or old.tripped_at is distinct from new.tripped_at
     or old.created_at is distinct from new.created_at then
    raise exception 'execution_breaker_identity_immutable';
  end if;
  if old.status<>'tripped' or new.status<>'reset' then
    raise exception 'execution_breaker_transition_denied';
  end if;
  if new.reset_at is null or char_length(btrim(coalesce(new.reset_by,'')))<3
     or char_length(btrim(coalesce(new.reset_reason,'')))<3 then
    raise exception 'execution_breaker_reset_evidence_required';
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;

drop trigger if exists trg_hq_workforce_execution_breaker_transition on public.hq_workforce_execution_breakers;
create trigger trg_hq_workforce_execution_breaker_transition
before update or delete on public.hq_workforce_execution_breakers
for each row execute function public.hq_workforce_guard_execution_breaker_transition();

create or replace function public.hq_workforce_trip_execution_breaker(
  p_scope_type text,
  p_scope_ref text,
  p_reason_code text,
  p_actor text,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_scope_type text:=btrim(coalesce(p_scope_type,''));
  v_scope_ref text:=btrim(coalesce(p_scope_ref,''));
  v_id uuid;
begin
  if v_scope_type not in ('global','capability','authority_grant') then raise exception 'execution_breaker_scope_invalid'; end if;
  if v_scope_type='global' then v_scope_ref:='global'; end if;
  if char_length(v_scope_ref) not between 1 and 240 then raise exception 'execution_breaker_scope_ref_invalid'; end if;
  if char_length(btrim(coalesce(p_reason_code,''))) not between 3 and 240 then raise exception 'execution_breaker_reason_required'; end if;
  if char_length(btrim(coalesce(p_actor,''))) not between 3 and 240 then raise exception 'execution_breaker_actor_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then raise exception 'execution_breaker_evidence_invalid'; end if;
  if v_scope_type='authority_grant' then
    perform 1 from public.hq_workforce_capability_authority_grants where id=v_scope_ref::uuid;
    if not found then raise exception 'execution_breaker_authority_not_found'; end if;
  end if;

  -- Serialize trip/reset state transitions for this exact scope.
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|'||v_scope_type||'|'||v_scope_ref,0));
  select id into v_id from public.hq_workforce_execution_breakers
   where scope_type=v_scope_type and scope_ref=v_scope_ref and status='tripped'
   for update;
  if found then return v_id; end if;

  insert into public.hq_workforce_execution_breakers(scope_type,scope_ref,status,reason_code,tripped_by)
  values(v_scope_type,v_scope_ref,'tripped',btrim(p_reason_code),btrim(p_actor))
  returning id into v_id;
  insert into public.hq_workforce_execution_breaker_events(
    breaker_id,event_kind,actor,reason_code,evidence
  ) values(v_id,'tripped',btrim(p_actor),btrim(p_reason_code),p_evidence);
  return v_id;
end $$;

create or replace function public.hq_workforce_reset_execution_breaker(
  p_breaker_id uuid,
  p_actor text,
  p_reason_code text,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.hq_workforce_execution_breakers%rowtype;
begin
  if char_length(btrim(coalesce(p_actor,''))) not between 3 and 240 then raise exception 'execution_breaker_reset_actor_required'; end if;
  if char_length(btrim(coalesce(p_reason_code,''))) not between 3 and 240 then raise exception 'execution_breaker_reset_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then raise exception 'execution_breaker_evidence_invalid'; end if;
  select * into b from public.hq_workforce_execution_breakers where id=p_breaker_id for update;
  if not found then raise exception 'execution_breaker_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|'||b.scope_type||'|'||b.scope_ref,0));
  if b.status='reset' then return b.id; end if;
  update public.hq_workforce_execution_breakers
     set status='reset',reset_by=btrim(p_actor),reset_reason=btrim(p_reason_code),reset_at=clock_timestamp()
   where id=b.id and status='tripped';
  if not found then raise exception 'execution_breaker_reset_race'; end if;
  insert into public.hq_workforce_execution_breaker_events(
    breaker_id,event_kind,actor,reason_code,evidence
  ) values(b.id,'reset',btrim(p_actor),btrim(p_reason_code),p_evidence||jsonb_build_object('authority_effect','none','mutation_authority_granted',false));
  return b.id;
end $$;

-- This assertion is deliberately internal. It acquires the same scope locks as trip/reset
-- so execution cannot pass a check concurrently with a breaker becoming authoritative.
create or replace function public.hq_workforce_assert_execution_not_stopped(
  p_task_id uuid,
  p_stage text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  b public.hq_workforce_execution_breakers%rowtype;
  v_capability_ref text;
  v_authority_ref text;
begin
  if p_stage not in ('pre_reservation','pre_mutation') then raise exception 'execution_breaker_stage_invalid'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  v_capability_ref:=t.capability_key||'@'||t.capability_version::text;
  v_authority_ref:=case when t.autonomous_authority_grant_id is null then null else t.autonomous_authority_grant_id::text end;

  -- Fixed lock order prevents deadlocks across global/capability/authority scopes.
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|global|global',0));
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|capability|'||v_capability_ref,0));
  if v_authority_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|authority_grant|'||v_authority_ref,0));
  end if;

  select * into b from public.hq_workforce_execution_breakers
   where status='tripped' and (
     (scope_type='global' and scope_ref='global')
     or (scope_type='capability' and scope_ref=v_capability_ref)
     or (scope_type='authority_grant' and scope_ref=v_authority_ref)
   )
   order by case scope_type when 'global' then 1 when 'capability' then 2 else 3 end,created_at
   limit 1 for update;
  if found then
    insert into public.hq_workforce_execution_breaker_events(
      breaker_id,event_kind,task_id,authority_grant_id,capability_key,actor,reason_code,evidence
    ) values(
      b.id,'execution_blocked',t.id,t.autonomous_authority_grant_id,t.capability_key,
      'worker-engine',b.reason_code,jsonb_build_object('stage',p_stage,'scope_type',b.scope_type,'scope_ref',b.scope_ref)
    );
    raise exception 'execution_circuit_breaker_tripped:%:%',b.scope_type,b.scope_ref;
  end if;
  return jsonb_build_object('stopped',false,'stage',p_stage);
end $$;

-- Replace only the canonical consequential gateway. R1.4.3-R1.4.7 semantics remain
-- unchanged except for two subtractive stop checks: before budget/resource reservation
-- and immediately before mutation.
create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  limits jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
  v_before jsonb;
  v_after jsonb;
  result jsonb;
  started_at timestamptz:=clock_timestamp();
  max_runtime_ms integer;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_authority_id:=nullif(auth->>'authority_grant_id','')::uuid;
  if v_authority_id is null then raise exception 'consequential_authority_evidence_missing'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if t.autonomous_authority_grant_id is distinct from v_authority_id then raise exception 'consequential_authority_binding_mismatch'; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=v_authority_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  max_runtime_ms:=g.max_runtime_ms;
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
  else raise exception 'tool_handler_not_allowlisted'; end if;

  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then
    return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id);
  end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;

  -- A stop dominates otherwise-valid authority and happens before budget/limit reservation.
  perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_reservation');
  if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;
    if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
    if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
    if wi.status<>'open' then raise exception 'work_item_not_open'; end if;

    v_before:=jsonb_build_object('status',wi.status,'action_taken',coalesce(wi.action_taken,'null'::jsonb),'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end);
    v_after:=jsonb_build_object('status','in_progress','task_id',t.id::text,'authority_grant_id',v_authority_id::text,'plan_step_id',t.plan_step_id::text,'execution_intent_id',v_intent_id::text);
    update public.hq_workforce_execution_intents set authoritative_before_state=v_before,expected_after_state=v_after where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;

    limits:=public.hq_workforce_reserve_capability_execution(t.id,1);
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;

    -- Second check closes a concurrent trip-vs-execute race before consequential mutation.
    perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_mutation');

    update public.hq_work_items
       set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
             'worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,
             'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),
           acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress'
     where id=work_item_id;
    if not found then raise exception 'work_item_mutation_failed'; end if;

    if not exists(select 1 from public.hq_workforce_execution_intents where id=v_intent_id and status='reserved' and authoritative_before_state<>'{}'::jsonb and expected_after_state<>'{}'::jsonb) then
      raise exception 'execution_recovery_snapshot_not_recorded';
    end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded'; end if;

    result:=jsonb_build_object(
      'handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
      'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,
      'side_effect','hq_work_items.updated','authorization',auth,'capability_limits',limits,
      'circuit_breakers_checked',true,
      'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000),'idempotent_replay',false
    );
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    perform public.hq_workforce_commit_execution_intent(v_intent_id,result);
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return public.hq_workforce_consequential_execution_gateway(p_task_id); end $$;

revoke all on function public.hq_workforce_guard_execution_breaker_event_immutable() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_guard_execution_breaker_transition() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_assert_execution_not_stopped(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_trip_execution_breaker(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_trip_execution_breaker(text,text,text,text,jsonb) to service_role;
grant execute on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb) to service_role;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
grant execute on function public.hq_workforce_tool_gateway_execute(uuid) to service_role;

-- Gate invariant: a stop layer can only narrow execution.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.8 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.8 violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.8 cannot activate capability authority'; end if;
end $$;
