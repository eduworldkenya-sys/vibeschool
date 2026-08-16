-- Worker Engine production-readiness hardening: per-execution budget evidence.
-- NON-ACTIVATING. Evidence-only; no budget limit, authority, runtime, or scheduler state is changed.
-- access: service-only public.hq_workforce_execution_budget_events
-- authorization-test: public.hq_workforce_execution_budget_events denies public/anon/authenticated/service_role direct mutation; internal trigger appends evidence only.

create table if not exists public.hq_workforce_execution_budget_events (
  id bigint generated always as identity primary key,
  execution_id uuid not null references public.hq_workforce_execution_envelopes(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  intent_id uuid not null references public.hq_workforce_execution_intents(id) on delete restrict,
  budget_id uuid references public.hq_workforce_execution_budgets(id) on delete restrict,
  event_kind text not null check (event_kind in ('pre_reservation','committed','blocked')),
  budget_key text not null,
  unit text,
  requested_amount bigint not null check (requested_amount > 0),
  actual_consumed_amount bigint not null default 0 check (actual_consumed_amount >= 0),
  limit_amount bigint,
  consumed_amount bigint,
  reserved_amount bigint,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  unique(intent_id,event_kind)
);

alter table public.hq_workforce_execution_budget_events enable row level security;
revoke all on table public.hq_workforce_execution_budget_events from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_budget_events to service_role;

create or replace function public.hq_workforce_capture_execution_budget_evidence()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  e public.hq_workforce_execution_envelopes%rowtype;
  b public.hq_workforce_execution_budgets%rowtype;
  v_kind text;
  v_actual bigint:=0;
begin
  if tg_op='INSERT' then
    v_kind:='pre_reservation';
  elsif tg_op='UPDATE' and old.status='reserved' and new.status in ('committed','blocked') then
    v_kind:=new.status;
    if new.status='committed' then v_actual:=coalesce((select budget_amount from public.hq_workforce_task_contracts where id=new.task_id),0); end if;
  else
    return new;
  end if;

  select * into t from public.hq_workforce_task_contracts where id=new.task_id;
  if not found then raise exception 'budget_evidence_task_missing'; end if;
  select * into e from public.hq_workforce_execution_envelopes where task_id=t.id;
  if not found then raise exception 'budget_evidence_execution_envelope_missing'; end if;

  select * into b
  from public.hq_workforce_execution_budgets
  where worker_key=t.worker_key and budget_key=t.budget_key
    and clock_timestamp()>=period_start and clock_timestamp()<period_end
    and status in ('active','exhausted')
  order by period_start desc limit 1;

  insert into public.hq_workforce_execution_budget_events(
    execution_id,task_id,intent_id,budget_id,event_kind,budget_key,unit,requested_amount,
    actual_consumed_amount,limit_amount,consumed_amount,reserved_amount,evidence
  ) values(
    e.id,t.id,new.id,b.id,v_kind,t.budget_key,b.unit,t.budget_amount,
    case when v_kind='committed' then t.budget_amount else 0 end,
    b.limit_amount,b.consumed_amount,b.reserved_amount,
    jsonb_build_object(
      'intent_status',new.status,
      'budget_present',b.id is not null,
      'snapshot_phase',v_kind,
      'financial_cost_minor',0,
      'financial_cost_basis','no_external_cost_recorded_for_this_internal_execution'
    )
  ) on conflict(intent_id,event_kind) do nothing;
  return new;
end $$;

revoke all on function public.hq_workforce_capture_execution_budget_evidence() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_capture_execution_budget_evidence on public.hq_workforce_execution_intents;
create trigger trg_hq_workforce_capture_execution_budget_evidence
after insert or update of status on public.hq_workforce_execution_intents
for each row execute function public.hq_workforce_capture_execution_budget_evidence();

create or replace function public.hq_workforce_execution_budget_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'worker_engine_execution_budget_evidence_is_append_only';
end $$;
revoke all on function public.hq_workforce_execution_budget_events_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_execution_budget_events_immutable on public.hq_workforce_execution_budget_events;
create trigger trg_hq_workforce_execution_budget_events_immutable
before update or delete on public.hq_workforce_execution_budget_events
for each row execute function public.hq_workforce_execution_budget_events_immutable();

-- No activation is permitted as a side effect of accounting evidence.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'budget evidence migration changed runtime boundary';
  end if;
end $$;
